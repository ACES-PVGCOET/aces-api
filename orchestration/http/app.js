import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../../shared/config/index.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { notFoundHandlerMiddleware } from './middleware/notFoundHandler.js';
import iamRoutes from '../../iam/http/iam.routes.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);

// Standard Body Parsers & Loggers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Mount API Router under /api/v1
app.use('/api/v1', apiV1Router);

// Not Found & Global Error Handling Middlewares
app.use(notFoundHandlerMiddleware);
app.use(errorHandlerMiddleware);

export default app;
