import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../orchestration/http/app.js';
import { config } from '../../shared/config/index.js';
import { AnnouncementModel } from '../../announcements/internal/announcement.model.js';
import { Form } from '../../forms/internal/form.model.js';
import { Question } from '../../forms/internal/question.model.js';
import { FormResponse } from '../../forms/internal/response.model.js';
import { EventModel } from '../../events/internal/event.model.js';
import { GalleryItemModel } from '../../gallery/internal/gallery.model.js';
import { MemberModel } from '../../iam/internal/member.model.js';

let mongoServer;
let server;
let baseUrl;

/**
 * Start MongoMemoryServer, connect Mongoose, and start Express server on ephemeral port
 */
export async function startTestServer() {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  return { baseUrl };
}

/**
 * Clear all test database collections
 */
export async function clearDatabase() {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      AnnouncementModel.deleteMany({}),
      Form.deleteMany({}),
      Question.deleteMany({}),
      FormResponse.deleteMany({}),
      EventModel.deleteMany({}),
      GalleryItemModel.deleteMany({}),
      MemberModel.deleteMany({}),
    ]);
  }
}

/**
 * Close HTTP server, Mongoose connection, and MongoMemoryServer
 */
export async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Helper to generate JWT tokens for specified test roles with valid 24-char hex ObjectIds
 */
export function generateTestToken({ id = '66b64f9e1234567890000001', roles = ['admin'], email = 'test@aces.org', team = 'Executive', position = 'Admin' } = {}) {
  const payload = { id, roles, email, team, position };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
}

/**
 * Helper to make HTTP requests using Node built-in fetch
 */
export async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data;
  try {
    data = await res.json();
  } catch (_e) {
    data = null;
  }

  return {
    status: res.status,
    body: data,
  };
}
