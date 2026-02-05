  private async cmdBan(bot: any, message: Message, args: string[]) {
    // ... existing lookup logic
    await member.ban({ reason });
    // use localization
    const text = this.bot.t('moderation.banned', { user: `<@${targetId}>`, reason }, message.guild?.preferredLocale || 'en');
    const log = new ModLogModel({ ... });
    await log.save().catch(() => null);
    message.channel.send(text);
  }