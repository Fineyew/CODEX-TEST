import GuildModel, { IGuild } from '../models/Guild';
import redis from './redisClient';
import logger from './logger';

const CACHE_TTL = Number(process.env.GUILD_CACHE_TTL || 30); // seconds

export default class GuildSettings {
  private redisClient = redis;

  private cacheKey(guildId: string) {
    return `guild:${guildId}:settings`;
  }

  public async get(guildId: string): Promise<IGuild> {
    const key = this.cacheKey(guildId);
    try {
      const cached = await this.redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as IGuild;
      }
    } catch (err) {
      logger.error(err as Error);
    }

    let doc = await GuildModel.findById(guildId).lean().exec();
    if (!doc) {
      const created = new GuildModel({ _id: guildId });
      await created.save().catch(e => logger.error(e as Error));
      doc = created.toObject() as IGuild;
    }

    try {
      await this.redisClient.set(key, JSON.stringify(doc), 'EX', CACHE_TTL);
    } catch (err) {
      logger.error(err as Error);
    }
    return doc;
  }

  public async invalidate(guildId: string) {
    try {
      await this.redisClient.del(this.cacheKey(guildId));
    } catch (err) {
      logger.error(err as Error);
    }
  }
}