import 'dotenv/config';
import Bot from './core/Bot';
import { initSentry } from './core/sentry';
import { startMetricsServer } from './services/metrics';
import './api/server'; // start API server

(async () => {
  initSentry();
  startMetricsServer();
  const bot = new Bot();
  await bot.init();
})();