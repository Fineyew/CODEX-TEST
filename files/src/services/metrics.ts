import express from 'express';
import client from 'prom-client';
import logger from '../core/logger';
import cookieParser from 'cookie-parser';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequests = new client.Counter({
  name: 'dyno_replica_http_requests_total',
  help: 'Total HTTP requests',
});
registry.registerMetric(httpRequests);

export function incrementRequest() {
  httpRequests.inc();
}

export function startMetricsServer(port = Number(process.env.METRICS_PORT) || 9400) {
  const app = express();
  app.use(cookieParser());
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.send(await registry.metrics());
    } catch (err) {
      logger.error(err as Error);
      res.status(500).send('Error collecting metrics');
    }
  });
  app.listen(port, () => logger.info(`Metrics endpoint listening on :${port}/metrics`));
}

export default registry;