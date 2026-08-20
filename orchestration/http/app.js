import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from '../../shared/config/index.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { notFoundHandlerMiddleware } from './middleware/notFoundHandler.js';
import iamRoutes from '../../iam/http/iam.routes.js';
import formsRoutes from '../../forms/http/forms.routes.js';
import announcementsRoutes from '../../announcements/http/announcements.routes.js';
import galleryRoutes from '../../gallery/http/gallery.routes.js';
import eventsRoutes from '../../events/http/event.route.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl/mobile) or matching client origins / localhost
      if (!origin) return callback(null, true);

      const allowedOrigins = config.clientOrigins || [];
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin === config.clientOrigin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Standard Body Parsers & Loggers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(requestLoggerMiddleware);

// Health Check Endpoint
app.get('/health', (_req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API v1 Routes
const apiV1Router = express.Router();
apiV1Router.get('/health', (_req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
apiV1Router.use('/iam', iamRoutes);
apiV1Router.use('/forms', formsRoutes);
apiV1Router.use('/announcements', announcementsRoutes);
apiV1Router.use('/gallery', galleryRoutes);
apiV1Router.use('/events', eventsRoutes);

// Mount API Router under /api/v1
app.use('/api/v1', apiV1Router);

// Not Found & Global Error Handling Middlewares
app.use(notFoundHandlerMiddleware);
app.use(errorHandlerMiddleware);

export default app;
