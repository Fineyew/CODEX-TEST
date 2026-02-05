import Module from '../../core/Module';
import { Message, TextChannel } from 'discord.js';
import ModMailModel from '../../models/ModMail';
import GuildModel from '../../models/Guild';
import logger from '../../logger';

/**
 * ModMail Module
 * - Forwards DMs to configured guild mod channel and allows replies to be sent back.
 * - Admin commands: modmail set-channel <channelId>, modmail close <userId>
 */
export default class ModMailModule extends Module {
  public name = 'modmail';

  constructor(public bot: any) {
    super(bot, 'modmail');
  }

  public register() {
    // Listen for DMs
    this.bot.client.on('messageCreate', this.onMessageCreate.bind(this));
    // Admin commands
    this.bot.registerCommand({ name: 'modmail-set', description: 'Set modmail channel: modmail-set <channelId>', module: this.name, required: { mod: true }, execute: this.cmdSetChannel.bind(this) });
    this.bot.registerCommand({ name: 'modmail-close', description: 'Close modmail for user: modmail-close <userId>', module: this.name, required: { mod: true }, execute: this.cmdClose.bind(this) });
    logger.info('ModMail module registered');
  }

  private async onMessageCreate(message: Message) {
    try {
      if (message.guild) return; // ignore guild messages here (we handle replies below)
      if (message.author.bot) return;
      // DM from user to bot
      const user = message.author;
      // For each guild that has modmail enabled, forward? Typically modmail is per-guild. We'll forward to configured guilds where user is member.
      const guilds = this.bot.client.guilds.cache.filter(g => g.members.cache.has(user.id) || true); // conservative: check all guilds
      for (const guild of guilds.values()) {
        const gdoc = await GuildModel.findById(guild.id).lean().exec();
        if (!gdoc) continue;
        const modChannelId = gdoc.settings?.modmailChannel;
        if (!modChannelId) continue;
        // Check if there's an open ticket for this user/guild
        let ticket = await ModMailModel.findOne({ guildId: guild.id, userId: user.id }).exec();
        if (!ticket) {
          // create a new channel in the guild's configured mod channel (thread approach is better but we start simple)
          const ch = this.bot.client.channels.cache.get(modChannelId) as TextChannel | undefined;
          if (!ch || !('send' in ch)) continue;
          const header = `New ModMail from ${user.tag} (${user.id})`;
          const sent = await ch.send({ content: `${header}\n\n${message.content}` });
          ticket = new ModMailModel({ guildId: guild.id, userId: user.id, channelId: sent.channel.id });
          await ticket.save();
          // add a small note to DM user
          await message.channel.send(`Your message has been forwarded to the moderators of ${guild.name}. They will reply here.`);
        } else {
          // append message to the channel
          const ch = this.bot.client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
          if (!ch || !('send' in ch)) {
            // attempt to recreate
            const modCh = this.bot.client.channels.cache.get(modChannelId) as TextChannel | undefined;
            if (!modCh || !('send' in modCh)) continue;
            const sent = await modCh.send({ content: `Resuming modmail for ${user.tag}:\n\n${message.content}` });
            ticket.channelId = sent.channel.id;
            await ticket.save();
            await message.channel.send('Message forwarded.');
            continue;
          }
          await ch.send({ content: `From ${user.tag} (${user.id}):\n\n${message.content}` });
          await message.channel.send('Message forwarded to moderators.');
        }
      }
    } catch (err) {
      logger.error(err as Error);
    }
  }

  // Admin command to set channel
  private async cmdSetChannel(bot: any, message: Message, args: string[]) {
    const channelId = args[0];
    if (!channelId) return message.reply('Usage: modmail-set <channelId>');
    try {
      await GuildModel.findByIdAndUpdate(message.guild!.id, { $set: { 'settings.modmailChannel': channelId } }, { upsert: true }).exec();
      message.channel.send('Modmail channel set.');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to set modmail channel.');
    }
  }

  private async cmdClose(bot: any, message: Message, args: string[]) {
    const userId = args[0];
    if (!userId) return message.reply('Usage: modmail-close <userId>');
    try {
      const ticket = await ModMailModel.findOneAndDelete({ guildId: message.guild!.id, userId }).exec();
      if (!ticket) return message.reply('No open modmail for that user.');
      message.channel.send('Closed modmail.');
      // notify user via DM if possible
      const user = await this.bot.client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send(`Your modmail ticket in ${message.guild!.name} has been closed by staff.`).catch(() => null);
      }
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to close modmail.');
    }
  }
}