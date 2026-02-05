import GuildModel from '../models/Guild';
import { Client, GuildMember } from 'discord.js';
import logger from '../logger';

/**
 * Very small permission manager skeleton.
 * Expand with role-hierarchy, per-command ACLs, caching and DB-backed overrides.
 */
export default class PermissionsManager {
  constructor(public client: Client) {}

  /**
   * Check whether a Discord member has permission to run a command based on guild config.
   * - adminOverride: server administrators always pass
   * - mod role check: checks guild.modRole if set
   */
  public async canExecute(guildId: string, member: GuildMember, required: { mod?: boolean, admin?: boolean } = {}) {
    if (!member) return false;
    if (member.id === this.client.user?.id) return true;
    if (member.permissions.has('Administrator')) return true;
    if (required.admin) return false; // only server admin allowed and that check above failed

    if (required.mod) {
      try {
        const gdoc = await GuildModel.findById(guildId).lean().exec();
        if (!gdoc) return false;
        if (gdoc.modRole && member.roles.cache.has(gdoc.modRole)) return true;
      } catch (err) {
        logger.error(err as Error);
      }
      return false;
    }

    return true;
  }
}