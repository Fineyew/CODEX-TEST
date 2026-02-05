import * as Sentry from '@sentry/node';
import logger from './logger';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not set; skipping Sentry init.');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.05,
  });
  logger.info('Sentry initialized');
}

export { Sentry };