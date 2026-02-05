import Module from '../../core/Module';
import { Message } from 'discord.js';
import MusicManager from '../../core/MusicManager';
import logger from '../../logger';
import GuildModel from '../../models/Guild';

export default class MusicModule extends Module {
  public name = 'music';
  private manager: MusicManager;

  constructor(public bot: any) {
    super(bot, 'music');
    this.manager = new MusicManager(this.bot.client);
    this.bot.client.once('ready', () => {
      this.manager.init();
    });
  }

  public register() {
    this.bot.registerCommand({
      name: 'play',
      description: 'Play a track: play <url or search>',
      module: this.name,
      execute: this.cmdPlay.bind(this),
    });
    this.bot.registerCommand({ name: 'skip', description: 'Skip', module: this.name, execute: this.cmdSkip.bind(this) });
    this.bot.registerCommand({ name: 'queue', description: 'Queue', module: this.name, execute: this.cmdQueue.bind(this) });
    this.bot.registerCommand({ name: 'nowplaying', description: 'Now playing', module: this.name, execute: this.cmdNow.bind(this) });
    this.bot.registerCommand({ name: 'leave', description: 'Leave', module: this.name, required: { mod: true }, execute: this.cmdLeave.bind(this) });
    this.bot.registerCommand({ name: 'volume', description: 'Volume', module: this.name, required: { mod: true }, execute: this.cmdVolume.bind(this) });
    this.bot.registerCommand({ name: 'shuffle', description: 'Shuffle', module: this.name, required: { mod: true }, execute: this.cmdShuffle.bind(this) });
    this.bot.registerCommand({ name: 'pause', description: 'Pause', module: this.name, execute: this.cmdPause.bind(this) });
    this.bot.registerCommand({ name: 'resume', description: 'Resume', module: this.name, execute: this.cmdResume.bind(this) });

    logger.info('Music module registered');
  }

  private async ensureUserInVoice(message: Message) {
    if (!message.member || !message.member.voice.channel) {
      await message.reply('You must be in a voice channel to use music commands.');
      return null;
    }
    return message.member.voice.channel;
  }

  // DJ enforcement: checks guild djRole setting or mod permission via bot.perms
  private async hasDJPermission(message: Message) {
    try {
      const gdoc = await GuildModel.findById(message.guild!.id).lean().exec();
      if (gdoc && gdoc.djRole && message.member && message.member.roles.cache.has(gdoc.djRole)) return true;
      // fallback to bot's permissions manager mod flag
      const ok = await this.bot.perms.canExecute(message.guild!.id, message.member, { mod: true });
      return ok;
    } catch (err) {
      logger.error(err as Error);
      return false;
    }
  }

  private async cmdPlay(bot: any, message: Message, args: string[]) {
    const query = args.join(' ');
    if (!query) return message.reply('Usage: play <url or search>');
    const voice = await this.ensureUserInVoice(message);
    if (!voice) return;

    // Optional DJ enforcement: if djRole set and user is not DJ/mod, deny adding (configurable)
    const gdoc = await GuildModel.findById(message.guild!.id).lean().exec();
    if (gdoc && gdoc.settings?.music?.requireDJToQueue) {
      const allowed = await this.hasDJPermission(message);
      if (!allowed) return message.reply('You must be DJ or moderator to queue music.');
    }

    try {
      // resolve search
      const resolved = await this.manager.search(message.guild!.id, query);
      if (!resolved || !resolved.tracks || !resolved.tracks.length) {
        return message.channel.send('No results found.');
      }

      const pushed = await this.manager.enqueueResolved(message.guild!.id, resolved, message.author.id);
      if (!pushed || !pushed.length) return message.channel.send('Failed to enqueue track(s).');

      message.channel.send(`Queued ${pushed.length} track(s).`);
      // If nothing currently playing, start playback
      const q = await this.manager.getQueue(message.guild!.id);
      const player = this.manager.manager.players.get(message.guild!.id);
      if ((!player || !player.playing) && q && q.tracks.length) {
        await this.manager.play(message.guild!.id, voice, message.author.id).catch(err => logger.error(err as Error));
      }
    } catch (err) {
      logger.error(err as Error);
      message.reply('Search/play failed.');
    }
  }

  private async cmdSkip(bot: any, message: Message) {
    try {
      const allowed = await this.hasDJPermission(message);
      if (!allowed) return message.reply('You must be DJ or moderator to skip.');
      const next = await this.manager.skip(message.guild!.id);
      if (next) return message.channel.send(`Skipped. Now playing: ${next.title}`);
      return message.channel.send('Queue ended, leaving.');
    } catch (err) {
      logger.error(err as Error);
      return message.channel.send('Failed to skip.');
    }
  }

  private async cmdQueue(bot: any, message: Message) {
    const q = await this.manager.getQueue(message.guild!.id);
    if (!q || !q.tracks || q.tracks.length === 0) return message.channel.send('Queue empty');
    const items = q.tracks.map((t, i) => `${i === q.position ? '▶' : `${i+1}.`} ${t.title} (${t.requesterId ? `<@${t.requesterId}>` : 'unknown'})`);
    const page = items.slice(0, 10).join('\n');
    return message.channel.send(`Queue:\n${page}`);
  }

  private async cmdNow(bot: any, message: Message) {
    const q = await this.manager.getQueue(message.guild!.id);
    if (!q || !q.tracks || q.tracks.length === 0) return message.channel.send('Nothing playing.');
    const t = q.tracks[q.position];
    return message.channel.send(`Now playing: ${t.title} — requested by ${t.requesterId ? `<@${t.requesterId}>` : 'unknown'}`);
  }

  private async cmdLeave(bot: any, message: Message) {
    try {
      const ok = await this.hasDJPermission(message);
      if (!ok) return message.reply('You must be DJ or moderator to stop the player.');
      await this.manager.stopAndClear(message.guild!.id);
      return message.channel.send('Stopped and left voice.');
    } catch (err) {
      logger.error(err as Error);
      return message.channel.send('Failed to leave.');
    }
  }

  private async cmdVolume(bot: any, message: Message, args: string[]) {
    try {
      const ok = await this.hasDJPermission(message);
      if (!ok) return message.reply('You must be DJ or moderator to set volume.');
      const v = Number(args[0]);
      if (isNaN(v) || v < 0 || v > 100) return message.channel.send('Volume must be 0-100');
      const res = await this.manager.setVolume(message.guild!.id, v);
      if (res) return message.channel.send(`Volume set to ${v}`);
      return message.channel.send('No active player to set volume.');
    } catch (err) {
      logger.error(err as Error);
      return message.channel.send('Failed to set volume.');
    }
  }

  private async cmdShuffle(bot: any, message: Message) {
    try {
      const ok = await this.hasDJPermission(message);
      if (!ok) return message.reply('You must be DJ or moderator to shuffle.');
      const q = await this.manager.shuffle(message.guild!.id);
      return message.channel.send('Queue shuffled.');
    } catch (err) {
      logger.error(err as Error);
      return message.channel.send('Failed to shuffle.');
    }
  }

  private async cmdPause(bot: any, message: Message) {
    const ok = await this.hasDJPermission(message);
    if (!ok) return message.reply('You must be DJ or moderator to pause.');
    const player = this.manager.manager.players.get(message.guild!.id);
    if (!player) return message.channel.send('No active player');
    player.pause(true);
    return message.channel.send('Paused.');
  }

  private async cmdResume(bot: any, message: Message) {
    const ok = await this.hasDJPermission(message);
    if (!ok) return message.reply('You must be DJ or moderator to resume.');
    const player = this.manager.manager.players.get(message.guild!.id);
    if (!player) return message.channel.send('No active player');
    player.pause(false);
    return message.channel.send('Resumed.');
  }
}