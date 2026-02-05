import Redis from 'ioredis';
import logger from './logger';

const redisUrl = process.env.REDIS_URI || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('error', (err) => logger.error('Redis error', err));

export default redis;