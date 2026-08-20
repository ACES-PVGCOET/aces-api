import app from './orchestration/http/app.js';
import { config } from './shared/config/index.js';
import { connectDB } from './shared/utils/db.js';
import { IAMService } from './iam/index.js';

let server;

/**
 * Initialize application database connection and start HTTP server
 */
const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    // Seed Initial Admin if needed
    await IAMService.seedInitialAdmin();

    // Start Express Server
    server = app.listen(config.port, "0.0.0.0", () => {
      console.info(`[Server] ACES API running in '${config.env}' mode on port ${config.port}`);
      console.info(`[Server] Health Check available at http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception thrown:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.info(`[Server] ${signal} signal received. Closing HTTP server gracefully...`);
  if (server) {
    server.close(() => {
      console.info('[Server] HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
