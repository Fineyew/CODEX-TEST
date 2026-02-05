import Module from '../../core/Module';
import { Message } from 'discord.js';
import GuildModel from '../../models/Guild';
import ModLogModel from '../../models/ModLog';
import logger from '../../logger';
import Redis from 'ioredis';

const INVITE_REGEX = /(discord(?:app)?\.com\/invite|discord\.gg)\/[A-Za-z0-9-]+/i;
const URL_REGEX = /https?:\/\/[^\s]+/i;

export default class AutomodModule extends Module {
  public name = 'automod';
  private redis: Redis.Redis;

  constructor(public bot: any) {
    super(bot, 'automod');
    this.redis = this.bot.redis;
  }

  public register() {
    // Listen for messages for automod checks
    this.bot.client.on('messageCreate', this.onMessageCreate.bind(this));
    logger.info('Automod module registered');
  }

  private async onMessageCreate(message: Message) {
    try {
      if (!message.guild || message.author.bot) return;
      // fetch guild settings quickly
      const gdoc = await GuildModel.findById(message.guild.id).lean().exec();
      if (!gdoc) return;

      // skip if disabled in guild
      const automodEnabled = gdoc.settings?.automodEnabled !== false;
      if (!automodEnabled) return;

      // 1) Invite/link blocking
      if (gdoc.settings?.automod?.blockInvites) {
        if (INVITE_REGEX.test(message.content)) {
          await this.takeActionDelete(message, 'invite detected', gdoc);
          return;
        }
      }

      if (gdoc.settings?.automod?.blockLinks) {
        if (URL_REGEX.test(message.content)) {
          await this.takeActionDelete(message, 'link detected', gdoc);
          return;
        }
      }

      // 2) Caps detection (percentage over threshold)
      if (gdoc.settings?.automod?.caps && typeof gdoc.settings.automod.caps === 'object') {
        const capsCfg = gdoc.settings.automod.caps;
        const text = message.content.replace(/[^A-Za-z]/g, '');
        const totalChars = message.content.replace(/\s+/g, '').length;
        if (totalChars > (capsCfg.minLength || 15)) {
          const capsChars = (text.match(/[A-Z]/g) || []).length;
          const pct = (capsChars / totalChars) * 100;
          if (pct >= (capsCfg.percent || 70)) {
            await this.takeActionDelete(message, 'excessive caps', gdoc);
            return;
          }
        }
      }

      // 3) Spam detection — per-user message count in short timeframe using redis
      const spamCfg = gdoc.settings?.automod?.spam || { messages: 6, seconds: 6 };
      const redisKey = `msgcount:${message.guild.id}:${message.author.id}`;
      try {
        const count = await this.redis.incr(redisKey);
        if (count === 1) {
          await this.redis.expire(redisKey, spamCfg.seconds || 6);
        }
        if (count >= (spamCfg.messages || 6)) {
          // take action (delete and warn/timeout)
          await this.takeActionTimeout(message, (spamCfg.timeoutSeconds || 60), 'spam detected', gdoc);
          // reset counter
          await this.redis.del(redisKey);
          return;
        }
      } catch (err) {
        logger.error(err as Error);
      }

    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async takeActionDelete(message: Message, reason: string, gdoc: any) {
    try {
      await message.delete().catch(() => null);
      await this.postModLog(gdoc._id, 'message_delete', message.author.id, null, reason);
      // optional: DM offender or notify moderation channel
      const lc = gdoc.logChannel;
      if (lc) {
        const ch = message.guild?.channels.cache.get(lc as string);
        if (ch && 'send' in ch) {
          // @ts-ignore
          ch.send(`Automod: deleted message from <@${message.author.id}> — ${reason}`);
        }
      }
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async takeActionTimeout(message: Message, seconds: number, reason: string, gdoc: any) {
    try {
      const member = await message.guild!.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        await this.postModLog(gdoc._id, 'automod_timeout_failed', message.author.id, null, reason);
        return;
      }
      const durMs = seconds * 1000;
      // @ts-ignore
      await member.timeout(durMs, `Automod: ${reason}`).catch(() => null);

      await this.postModLog(gdoc._id, 'automod_timeout', message.author.id, null, reason);
      await message.channel.send(`<@${message.author.id}> has been timed out (${seconds}s) — ${reason}`);
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async postModLog(guildId: string, type: string, userId: string, moderatorId: string | null, reason?: string) {
    try {
      const log = new ModLogModel({
        guildId,
        type,
        userId,
        moderatorId,
        reason,
      });
      await log.save().catch(() => null);

      // attempt to forward to channel if configured
      const gdoc = await GuildModel.findById(guildId).lean().exec();
      if (gdoc && gdoc.logChannel) {
        const guild = this.bot.client.guilds.cache.get(guildId);
        if (!guild) return;
        const ch = guild.channels.cache.get(gdoc.logChannel);
        if (ch && 'send' in ch) {
          // @ts-ignore
          ch.send(`[Automod] ${type} — <@${userId}> ${reason ? `| ${reason}` : ''}`);
        }
      }
    } catch (err) {
      logger.error(err as Error);
    }
  }
}