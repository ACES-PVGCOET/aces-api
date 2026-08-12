import mongoose from 'mongoose';
import { config } from '../config/index.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 4000,
    });
    console.info(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
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
      return conn;
    } catch (memError) {
      console.error(`[Database] Connection Error: ${memError.message}`);
      process.exit(1);
    }
  }
};

