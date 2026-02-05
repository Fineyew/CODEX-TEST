import winston from 'winston';

const useJson = process.env.LOG_JSON === '1';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: useJson
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const m = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${m}`;
        })
      ),
  transports: [new winston.transports.Console()],
});

export default logger;