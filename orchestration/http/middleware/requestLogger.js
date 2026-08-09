import morgan from 'morgan';
import { config } from '../../../shared/config/index.js';

export const requestLoggerMiddleware = morgan(
  config.env === 'development' ? 'dev' : 'combined'
);
