import crypto from 'crypto';
import redis from './redisClient';
import logger from './logger';

export default class IPCManager {
  private pub = redis;
  private sub = redis.duplicate();

  constructor(private channelPrefix = 'dyno:ipc:') {
    this.sub.on('message', (ch, message) => this.handleMessage(ch, message));
    this.sub.subscribe(`${this.channelPrefix}broadcast`).catch(err => logger.error('IPC subscribe error', err as Error));
  }

  // Simple publish (fire-and-forget)
  public async publish(topic: string, payload: any) {
    const ch = `${this.channelPrefix}${topic}`;
    await this.pub.publish(ch, JSON.stringify(payload));
  }

  // Request/response RPC
  public async request(topic: string, payload: any, timeout = 5000): Promise<any> {
    const id = crypto.randomBytes(8).toString('hex');
    const replyChannel = `${this.channelPrefix}reply:${id}`;

    return new Promise<any>((resolve, reject) => {
      const onMsg = (ch: string, msg: string) => {
        try {
          const data = JSON.parse(msg);
          if (data._id === id) {
            this.sub.removeListener('message', onMsg);
            clearTimeout(t);
            resolve(data.response);
          }
        } catch (e) {}
      };

      const t = setTimeout(() => {
        this.sub.removeListener('message', onMsg);
        reject(new Error('IPC request timeout'));
      }, timeout);

      this.sub.on('message', onMsg);
      // publish request with _id so responders know where to reply
      const ch = `${this.channelPrefix}${topic}`;
      this.pub.publish(ch, JSON.stringify({ _id: id, payload, replyTo: replyChannel })).catch(err => logger.error('IPC publish error', err as Error));
    });
  }

  // Basic handler map: consumers can register handlers for a topic
  private handlers: Map<string, (payload: any, meta: any) => Promise<any> | any> = new Map();

  public on(topic: string, handler: (payload: any, meta: any) => Promise<any> | any) {
    const ch = `${this.channelPrefix}${topic}`;
    this.handlers.set(ch, handler);
    this.sub.subscribe(ch).catch(err => logger.error('IPC subscribe error', err as Error));
  }

  private async handleMessage(channel: string, message: string) {
    try {
      const data = JSON.parse(message);
      const handler = this.handlers.get(channel);
      if (handler) {
        const res = await handler(data.payload, { replyTo: data.replyTo, id: data._id });
        if (data.replyTo && data._id) {
          await this.pub.publish(data.replyTo, JSON.stringify({ _id: data._id, response: res }));
        }
      } else {
        // no handler: ignore or broadcast
      }
    } catch (err) {
      logger.error('IPC handleMessage error', err as Error);
    }
  }
}