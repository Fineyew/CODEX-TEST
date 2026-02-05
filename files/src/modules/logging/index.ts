import Module from '../../core/Module';
import { Message } from 'discord.js';
import ModLogModel from '../../models/ModLog';
import GuildModel from '../../models/Guild';
import logger from '../../logger';

/**
 * Lightweight logging module: records message deletions & edits and forwards to configured logChannel.
 */
export default class LoggingModule extends Module {
  public name = 'logging';
  constructor(public bot: any) {
    super(bot, 'logging');
  }

  public register() {
    this.bot.client.on('messageDelete', this.onMessageDelete.bind(this));
    this.bot.client.on('messageUpdate', this.onMessageEdit.bind(this));
    this.bot.client.on('guildMemberAdd', this.onGuildMemberAdd.bind(this));
    this.bot.client.on('guildMemberRemove', this.onGuildMemberRemove.bind(this));
  }

  private async forwardToChannel(guildId: string, text: string) {
    try {
      const gdoc = await GuildModel.findById(guildId).lean().exec();
      if (!gdoc || !gdoc.logChannel) return;
      const guild = this.bot.client.guilds.cache.get(guildId);
      if (!guild) return;
      const ch = guild.channels.cache.get(gdoc.logChannel);
      if (ch && 'send' in ch) {
        // @ts-ignore
        ch.send(text);
      }
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async onMessageDelete(message: Message) {
    if (!message.guild) return;
    const text = `Message deleted in <#${message.channel.id}> by ${message.author ? `<@${message.author.id}>` : 'unknown'}: ${message.content || '[embed/attachment]'}`;
    await this.forwardToChannel(message.guild.id, text);
    const log = new ModLogModel({
      guildId: message.guild.id,
      type: 'message_delete',
      userId: message.author ? message.author.id : 'unknown',
      reason: message.content || null,
    });
    await log.save().catch(() => null);
  }

  private async onMessageEdit(oldMsg: Message | null, newMsg: Message) {
    if (!newMsg.guild) return;
    const oldC = oldMsg ? oldMsg.content : '[unknown]';
    const text = `Message edited in <#${newMsg.channel.id}> by <@${newMsg.author.id}>:\nBefore: ${oldC}\nAfter: ${newMsg.content || '[embed/attachment]'}`;
    await this.forwardToChannel(newMsg.guild.id, text);
    const log = new ModLogModel({
      guildId: newMsg.guild.id,
      type: 'message_edit',
      userId: newMsg.author.id,
      reason: `Before: ${oldC}`,
    });
    await log.save().catch(() => null);
  }

  private async onGuildMemberAdd(member: any) {
    if (!member.guild) return;
    await this.forwardToChannel(member.guild.id, `Member joined: <@${member.id}>`);
    await new ModLogModel({
      guildId: member.guild.id,
      type: 'join',
      userId: member.id,
    }).save().catch(() => null);
  }

  private async onGuildMemberRemove(member: any) {
    if (!member.guild) return;
    await this.forwardToChannel(member.guild.id, `Member left: <@${member.id}>`);
    await new ModLogModel({
      guildId: member.guild.id,
      type: 'leave',
      userId: member.id,
    }).save().catch(() => null);
  }
}