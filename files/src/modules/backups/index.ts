import Module from '../../core/Module';
import GuildModel from '../../models/Guild';
import ModLogModel from '../../models/ModLog';
import MusicQueueModel from '../../models/MusicQueue';
import logger from '../../logger';
import fs from 'fs';
import path from 'path';

/**
 * Backups Module
 * - Commands: backup export, backup import, backup list
 * - Stores backups in DB (or file) — for convenience we save to disk under backups/
 */
export default class BackupsModule extends Module {
  public name = 'backups';
  private folder = path.join(process.cwd(), 'backups');

  constructor(public bot: any) {
    super(bot, 'backups');
    if (!fs.existsSync(this.folder)) fs.mkdirSync(this.folder, { recursive: true });
  }

  public register() {
    this.bot.registerCommand({ name: 'backup-export', description: 'Export guild config backup: backup-export', module: this.name, required: { mod: true }, execute: this.cmdExport.bind(this) });
    this.bot.registerCommand({ name: 'backup-import', description: 'Import guild config from file: backup-import <filename>', module: this.name, required: { mod: true }, execute: this.cmdImport.bind(this) });
    this.bot.registerCommand({ name: 'backup-list', description: 'List backups: backup-list', module: this.name, required: { mod: true }, execute: this.cmdList.bind(this) });
  }

  private async cmdExport(bot: any, message: any) {
    try {
      const guildId = message.guild!.id;
      const guild = await GuildModel.findById(guildId).lean().exec();
      const logs = await ModLogModel.find({ guildId }).lean().exec();
      const queue = await MusicQueueModel.findOne({ guildId }).lean().exec();
      const payload = { guild, logs, queue, exportedAt: new Date() };
      const filename = `${guildId}-${Date.now()}.json`;
      const fp = path.join(this.folder, filename);
      fs.writeFileSync(fp, JSON.stringify(payload, null, 2));
      message.channel.send(`Backup exported: ${filename}`);
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to export backup.');
    }
  }

  private async cmdList(bot: any, message: any) {
    try {
      const files = fs.readdirSync(this.folder).filter(f => f.includes(message.guild!.id));
      if (!files.length) return message.channel.send('No backups for this guild.');
      message.channel.send(`Backups:\n${files.join('\n')}`);
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to list backups.');
    }
  }

  private async cmdImport(bot: any, message: any, args: string[]) {
    const filename = args[0];
    if (!filename) return message.reply('Usage: backup-import <filename>');
    try {
      const fp = path.join(this.folder, filename);
      if (!fs.existsSync(fp)) return message.reply('File not found.');
      const raw = fs.readFileSync(fp, 'utf8');
      const obj = JSON.parse(raw);
      if (!obj.guild) return message.reply('Invalid backup file.');
      // restore settings portion; do NOT blindly overwrite entire DB - keep it conservative
      await GuildModel.findByIdAndUpdate(message.guild!.id, { $set: { settings: obj.guild.settings || {}, prefix: obj.guild.prefix || '!' } }, { upsert: true }).exec();
      if (obj.queue) {
        await MusicQueueModel.findOneAndUpdate({ guildId: message.guild!.id }, { $set: { tracks: obj.queue.tracks || [], position: obj.queue.position || 0 } }, { upsert: true }).exec();
      }
      message.channel.send('Backup imported (partial: settings & queue).');
    } catch (err) {
      logger.error(err as Error);
      message.reply('Failed to import backup.');
    }
  }
}