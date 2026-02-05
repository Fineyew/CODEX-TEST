import Module from '../../core/Module';
import { Message } from 'discord.js';
import CustomCommandModel from '../../models/CustomCommand';
import logger from '../../logger';
import GuildModel from '../../models/Guild';

/**
 * Custom Commands Module
 * - Admin commands: ccadd, ccdel, cclist, ccedit
 * - Runtime: intercept commands matching custom triggers and execute templates
 */
export default class CustomCommandsModule extends Module {
  public name = 'customcommands';

  constructor(public bot: any) {
    super(bot, 'customcommands');
  }

  public register() {
    // admin CRUD commands
    this.bot.registerCommand({
      name: 'ccadd',
      description: 'Add a custom command: ccadd <name> <response>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdAdd.bind(this),
    });

    this.bot.registerCommand({
      name: 'ccdel',
      description: 'Delete a custom command: ccdel <name>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdDel.bind(this),
    });

    this.bot.registerCommand({
      name: 'cclist',
      description: 'List custom commands: cclist',
      module: this.name,
      required: { mod: true },
      execute: this.cmdList.bind(this),
    });

    this.bot.registerCommand({
      name: 'ccedit',
      description: 'Edit a custom command: ccedit <name> <new response>',
      module: this.name,
      required: { mod: true },
      execute: this.cmdEdit.bind(this),
    });

    // runtime interceptor
    this.bot.client.on('messageCreate', this.onMessageCreate.bind(this));
    logger.info('CustomCommands module registered');
  }

  private async onMessageCreate(message: Message) {
    try {
      if (!message.guild || message.author.bot) return;

      const prefix = (await this.getGuildPrefix(message.guild.id)) || '!';
      const content = message.content;
      if (!content.startsWith(prefix)) return;

      const invoked = content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

      const cc = await CustomCommandModel.findOne({ guildId: message.guild.id, name: invoked }).lean().exec();
      if (!cc) {
        // also check regex-based commands
        const regexes = await CustomCommandModel.find({ guildId: message.guild.id, regex: true }).lean().exec();
        for (const r of regexes) {
          const re = new RegExp(r.name, 'i');
          if (re.test(content.slice(prefix.length))) {
            if (!await this.canUserExecute(message, r)) return;
            const resp = this.renderTemplate(r.response, message);
            await message.channel.send(resp);
            return;
          }
        }
        return;
      }

      if (!await this.canUserExecute(message, cc)) return;

      const resp = this.renderTemplate(cc.response, message);
      await message.channel.send(resp);
    } catch (err) {
      logger.error(err as Error);
    }
  }

  private renderTemplate(template: string, message: Message) {
    // simple template replacements
    return template
      .replace(/\{user\}/g, `<@${message.author.id}>`)
      .replace(/\{user.name\}/g, message.author.username)
      .replace(/\{server\}/g, message.guild ? message.guild.name : '')
      .replace(/\{channel\}/g, `<#${message.channel.id}>`)
      .replace(/\{args\}/g, message.content.split(/ +/).slice(1).join(' '));
  }

  private async canUserExecute(message: Message, cc: any) {
    if (cc.allowEveryone) return true;
    if (!cc.allowedRoles || !cc.allowedRoles.length) {
      // default requires mod
      return await this.bot.perms.canExecute(message.guild!.id, message.member, { mod: true });
    }
    for (const r of cc.allowedRoles) {
      if (message.member && message.member.roles.cache.has(r)) return true;
    }
    return false;
  }

  private async getGuildPrefix(guildId: string) {
    const g = await GuildModel.findById(guildId).lean().exec();
    return g && g.prefix ? g.prefix : '!';
  }

  private async cmdAdd(bot: any, message: Message, args: string[]) {
    const name = args[0];
    if (!name) return message.reply('Usage: ccadd <name> <response>');
    const response = args.slice(1).join(' ');
    if (!response) return message.reply('Response required.');
    try {
      const cc = new (CustomCommandModel as any)({
        guildId: message.guild!.id,
        name: name.toLowerCase(),
        response,
        creatorId: message.author.id,
      });
      await cc.save();
      message.channel.send(`Custom command created: ${name}`);
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to create custom command (maybe it exists).');
    }
  }

  private async cmdDel(bot: any, message: Message, args: string[]) {
    const name = args[0];
    if (!name) return message.reply('Usage: ccdel <name>');
    try {
      const res = await CustomCommandModel.deleteOne({ guildId: message.guild!.id, name: name.toLowerCase() }).exec();
      if (res.deletedCount && res.deletedCount > 0) {
        message.channel.send(`Deleted custom command: ${name}`);
      } else {
        message.reply('No such command.');
      }
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to delete custom command.');
    }
  }

  private async cmdList(bot: any, message: Message) {
    const items = await CustomCommandModel.find({ guildId: message.guild!.id }).lean().exec();
    if (!items || !items.length) return message.channel.send('No custom commands.');
    const names = items.map(i => i.name).join(', ');
    message.channel.send(`Custom commands: ${names}`);
  }

  private async cmdEdit(bot: any, message: Message, args: string[]) {
    const name = args[0];
    if (!name) return message.reply('Usage: ccedit <name> <new response>');
    const response = args.slice(1).join(' ');
    if (!response) return message.reply('Response required.');
    try {
      const cc = await CustomCommandModel.findOneAndUpdate({ guildId: message.guild!.id, name: name.toLowerCase() }, { $set: { response } }, { new: true, upsert: false }).exec();
      if (!cc) return message.reply('No such command to edit.');
      message.channel.send(`Updated command: ${name}`);
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to edit command.');
    }
  }
}