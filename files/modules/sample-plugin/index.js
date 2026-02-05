// Simple sample plugin module (CommonJS) — safe to inspect before installing
module.exports = class SamplePlugin {
  constructor(bot) {
    this.bot = bot;
    this.name = 'sample-plugin';
    this._registered = false;
  }

  async register() {
    // Register a simple command (Bot.registerCommand expected)
    if (this.bot && typeof this.bot.registerCommand === 'function') {
      this.bot.registerCommand({
        name: 'sample',
        description: 'Sample plugin command',
        module: this.name,
        execute: async (bot, message /*, args */) => {
          // reply if message-like object present
          try {
            if (message && typeof message.reply === 'function') {
              message.reply('Sample plugin works!');
            }
          } catch (e) {}
        },
      });
      this._registered = true;
      if (!this.bot._plugins) this.bot._plugins = [];
      this.bot._plugins.push(this.name);
    }
  }

  async unload() {
    // Attempt to cleanup: remove command by name if bot exposes .commands (discord bot)
    try {
      if (this.bot && this.bot.commands && typeof this.bot.commands.delete === 'function') {
        this.bot.commands.delete('sample');
      }
    } catch (e) {}
    this._registered = false;
  }
};