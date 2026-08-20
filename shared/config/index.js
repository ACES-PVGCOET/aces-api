import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const trimQuotes = (str) => (typeof str === 'string' ? str.trim().replace(/^["']|["']$/g, '') : str);

const rawClientOrigin = trimQuotes(process.env.CLIENT_ORIGIN) || 'http://localhost:3000';
const clientOrigins = rawClientOrigin
  .split(',')
  .map((origin) => trimQuotes(origin.trim()))
  .filter(Boolean);

export const config = {
  env: trimQuotes(process.env.NODE_ENV) || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientOrigin: clientOrigins[0] || 'http://localhost:3000',
  clientOrigins: clientOrigins.length > 0 ? clientOrigins : ['http://localhost:3000'],
  mongo: {
    uri: trimQuotes(process.env.MONGO_URI) || 'mongodb://localhost:27017/aces_db',
  },
  jwt: {
    secret: trimQuotes(process.env.JWT_SECRET) || 'fallback_development_secret_change_me',
    expiresIn: trimQuotes(process.env.JWT_EXPIRES_IN) || '7d',
  },
  cloudinary: {
    cloudName: trimQuotes(process.env.CLOUDINARY_CLOUD_NAME) || '',
    apiKey: trimQuotes(process.env.CLOUDINARY_API_KEY) || '',
    apiSecret: trimQuotes(process.env.CLOUDINARY_API_SECRET) || '',
  },
  admin: {
    email: trimQuotes(process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL) || '',
    password: trimQuotes(process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) || 'Admin@123456',
  },
  resend: {
    apiKey: trimQuotes(process.env.RESEND_API_KEY) || '',
    from: trimQuotes(process.env.RESEND_FROM) || 'ACES Association <onboarding@resend.dev>',
  },
};
