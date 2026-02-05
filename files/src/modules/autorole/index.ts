import Module from '../../core/Module';
import GuildModel from '../../models/Guild';
import logger from '../../logger';

/**
 * Autorole / Welcome Module
 * - Assigns autorole on member join if configured in guild.settings.autorole
 * - Sends welcome message to configured channel (guild.settings.welcomeChannel)
 * - Commands: autorole set/remove, welcome set/remove
 */
export default class AutoroleModule extends Module {
  public name = 'autorole';

  constructor(public bot: any) {
    super(bot, 'autorole');
  }

  public register() {
    this.bot.client.on('guildMemberAdd', this.onGuildMemberAdd.bind(this));
    this.bot.registerCommand({ name: 'setautorole', description: 'Set autorole: setautorole <roleId>', module: this.name, required: { mod: true }, execute: this.cmdSetAutorole.bind(this) });
    this.bot.registerCommand({ name: 'clearautorole', description: 'Clear autorole', module: this.name, required: { mod: true }, execute: this.cmdClearAutorole.bind(this) });
    this.bot.registerCommand({ name: 'setwelcome', description: 'Set welcome channel: setwelcome <channelId>', module: this.name, required: { mod: true }, execute: this.cmdSetWelcome.bind(this) });
    this.bot.registerCommand({ name: 'clearwelcome', description: 'Clear welcome channel', module: this.name, required: { mod: true }, execute: this.cmdClearWelcome.bind(this) });
    logger.info('Autorole module registered');
  }

  private async onGuildMemberAdd(member: any) {
    try {
      const gdoc = await GuildModel.findById(member.guild.id).lean().exec();
      if (!gdoc) return;

      // autorole
      const roleId = gdoc.settings?.autorole;
      if (roleId) {
        try {
          await member.roles.add(roleId).catch(() => null);
        } catch (e) {}
      }

      // welcome message
      const welcomeChan = gdoc.settings?.welcomeChannel;
      if (welcomeChan) {
        const ch = member.guild.channels.cache.get(welcomeChan);
        if (ch && 'send' in ch) {
          // @ts-ignore
          ch.send(`Welcome ${member.user ? `<@${member.user.id}>` : member.id} to **${member.guild.name}**!`);
        }
      }

    } catch (err) {
      logger.error(err as Error);
    }
  }

  private async cmdSetAutorole(bot: any, message: any, args: string[]) {
    const roleId = args[0];
    if (!roleId) return message.reply('Usage: setautorole <roleId>');
    try {
      await GuildModel.findByIdAndUpdate(message.guild.id, { $set: { 'settings.autorole': roleId } }, { upsert: true }).exec();
      await this.bot.modules.bot?.perms; // noop to use existing structure
      message.channel.send('Autorole set.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to set autorole.');
    }
  }

  private async cmdClearAutorole(bot: any, message: any) {
    try {
      await GuildModel.findByIdAndUpdate(message.guild.id, { $unset: { 'settings.autorole': '' } }).exec();
      message.channel.send('Autorole cleared.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to clear autorole.');
    }
  }

  private async cmdSetWelcome(bot: any, message: any, args: string[]) {
    const channelId = args[0];
    if (!channelId) return message.reply('Usage: setwelcome <channelId>');
    try {
      await GuildModel.findByIdAndUpdate(message.guild.id, { $set: { 'settings.welcomeChannel': channelId } }, { upsert: true }).exec();
      message.channel.send('Welcome channel set.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to set welcome channel.');
    }
  }

  private async cmdClearWelcome(bot: any, message: any) {
    try {
      await GuildModel.findByIdAndUpdate(message.guild.id, { $unset: { 'settings.welcomeChannel': '' } }).exec();
      message.channel.send('Welcome channel cleared.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to clear welcome.');
    }
  }
}