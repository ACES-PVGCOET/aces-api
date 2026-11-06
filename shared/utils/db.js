import mongoose from 'mongoose';
import { config } from '../config/index.js';

export const syncDatabaseIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const collections = await db.listCollections({ name: 'formresponses' }).toArray();
    if (collections.length > 0) {
      const indexes = await db.collection('formresponses').indexes();
      const oldUniqueIndex = indexes.find(
        (idx) => idx.name === 'form_id_1_email_1' && idx.unique
      );
      if (oldUniqueIndex) {
        console.info('[Database] Dropping legacy unique index form_id_1_email_1 on formresponses...');
        await db.collection('formresponses').dropIndex('form_id_1_email_1');
        await db.collection('formresponses').createIndex({ form_id: 1, email: 1 });
        console.info('[Database] Successfully replaced with non-unique index form_id_1_email_1.');
      }
    }
  } catch (err) {
    console.warn('[Database] Index synchronization note:', err.message);
  }
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 4000,
    });
    console.info(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    await syncDatabaseIndexes();
    return conn;
  } catch (error) {
    console.warn(`[Database] Connection to '${config.mongo.uri}' failed: ${error.message}`);
    console.info('[Database] Starting in-memory MongoDB fallback...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.info(`[Database] In-Memory MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      await syncDatabaseIndexes();
      return conn;
    } catch (memError) {
      console.error(`[Database] Failed to initialize database or fallback in-memory server: ${memError.message}`);
      process.exit(1);
    }
  }
};
