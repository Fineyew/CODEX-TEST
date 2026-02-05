import Module from '../../core/Module';
import { MessageReaction, PartialUser, User } from 'discord.js';
import ReactionRoleModel from '../../models/ReactionRole';
import logger from '../../logger';

/**
 * Reaction Roles Module
 * Admin commands: rradd, rrdel, rllist
 * Listens for reaction add/remove and assigns/removes roles.
 */
export default class ReactionRolesModule extends Module {
  public name = 'reactionroles';

  constructor(public bot: any) {
    super(bot, 'reactionroles');
  }

  public register() {
    this.bot.registerCommand({
      name: 'rradd',
      description: 'Add reaction role: rradd <messageId> <emoji> <roleId>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdAdd.bind(this)
    });

    this.bot.registerCommand({
      name: 'rrdel',
      description: 'Remove reaction role: rrdel <messageId> <emoji>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdDel.bind(this)
    });

    this.bot.registerCommand({
      name: 'rrlist',
      description: 'List reaction roles for message: rrlist <messageId>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdList.bind(this)
    });

    this.bot.client.on('messageReactionAdd', this.onReactionAdd.bind(this));
    this.bot.client.on('messageReactionRemove', this.onReactionRemove.bind(this));
    logger.info('ReactionRoles module registered');
  }

  private async onReactionAdd(reaction: MessageReaction, user: User | PartialUser) {
    try {
      if (user.bot) return;
      // fetch partials if necessary
      if (reaction.partial) await reaction.fetch();
      const msg = reaction.message;
      const rr = await ReactionRoleModel.findOne({ guildId: msg.guild!.id, messageId: msg.id, emoji: reaction.emoji.identifier || reaction.emoji.name }).lean().exec();
      if (!rr) return;
      const member = await msg.guild!.members.fetch(user.id).catch(() => null);
      if (!member) return;
      await member.roles.add(rr.roleId).catch(() => null);
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async onReactionRemove(reaction: MessageReaction, user: User | PartialUser) {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      const msg = reaction.message;
      const rr = await ReactionRoleModel.findOne({ guildId: msg.guild!.id, messageId: msg.id, emoji: reaction.emoji.identifier || reaction.emoji.name }).lean().exec();
      if (!rr) return;
      const member = await msg.guild!.members.fetch(user.id).catch(() => null);
      if (!member) return;
      await member.roles.remove(rr.roleId).catch(() => null);
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async cmdAdd(bot: any, message: any, args: string[]) {
    const [messageId, emoji, roleId] = args;
    if (!messageId || !emoji || !roleId) return message.reply('Usage: rradd <messageId> <emoji> <roleId>');
    try {
      const rr = new ReactionRoleModel({ guildId: message.guild.id, messageId, emoji, roleId });
      await rr.save();
      // add reaction to message if bot can find it
      const targetChannel = message.channel;
      try {
        const targetMsg = await message.channel.messages.fetch(messageId).catch(() => null);
        if (targetMsg) await targetMsg.react(emoji).catch(() => null);
      } catch (e) {}
      message.channel.send('Reaction role added.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to add reaction role (duplicate?).');
    }
  }

  private async cmdDel(bot: any, message: any, args: string[]) {
    const [messageId, emoji] = args;
    if (!messageId || !emoji) return message.reply('Usage: rrdel <messageId> <emoji>');
    try {
      const res = await ReactionRoleModel.deleteOne({ guildId: message.guild.id, messageId, emoji }).exec();
      if (res.deletedCount && res.deletedCount > 0) {
        message.channel.send('Reaction role removed.');
      } else message.reply('Not found.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to remove reaction role.');
    }
  }

  private async cmdList(bot: any, message: any, args: string[]) {
    const [messageId] = args;
    if (!messageId) return message.reply('Usage: rrlist <messageId>');
    const rows = await ReactionRoleModel.find({ guildId: message.guild.id, messageId }).lean().exec();
    if (!rows || !rows.length) return message.channel.send('No reaction roles for that message.');
    const lines = rows.map(r => `${r.emoji} => <@&${r.roleId}>`);
    message.channel.send(`Reaction Roles:\n${lines.join('\n')}`);
  }
}