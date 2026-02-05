import { Manager, Node, Player, SearchResult } from '@erela.js/core';
import MusicQueueModel, { IMusicQueue, IQueuedTrack } from '../models/MusicQueue';
import logger from './logger';
import { Client, VoiceBasedChannel } from 'discord.js';
import clientProm from 'prom-client';

const musicPlays = new clientProm.Counter({ name: 'dyno_replica_music_plays_total', help: 'Total music plays' });
const musicSkips = new clientProm.Counter({ name: 'dyno_replica_music_skips_total', help: 'Total music skips' });
clientProm.register.registerMetric(musicPlays);
clientProm.register.registerMetric(musicSkips);

export default class MusicManager {
  public manager: Manager;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    const nodes = [
      {
        identifier: 'local',
        host: process.env.LAVALINK_HOST || '127.0.0.1',
        port: Number(process.env.LAVALINK_PORT || 2333),
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      },
    ];

    this.manager = new Manager({
      nodes,
      // @ts-ignore
      send: (guildId, payload) => {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;
        const shardId = (guild.shard && (guild.shard as any).id) || 0;
        // @ts-ignore
        this.client.ws.shards[shardId].send(payload);
      },
    });

    this.manager.on('nodeConnect', (node: Node) => logger.info(`Lavalink node connected: ${node.options.identifier}`));
    this.manager.on('nodeError', (node: Node, err) => logger.error(`Lavalink node error ${node.options.identifier}: ${err.message}`));
    this.manager.on('trackStart', (player: Player, track: any) => {
      logger.info(`Track started for guild ${player.guild}: ${track.title || track.identifier}`);
    });
  }

  public async init() {
    logger.info('MusicManager initialized');
  }

  private async getOrCreateQueue(guildId: string): Promise<IMusicQueue> {
    let q = await MusicQueueModel.findOne({ guildId }).exec();
    if (!q) {
      q = new MusicQueueModel({ guildId, tracks: [], position: 0 });
      await q.save();
    }
    return q;
  }

  // Normalized search: accepts query or URL. Returns SearchResult from erela.
  public async search(guildId: string, query: string) : Promise<SearchResult> {
    let searchQuery = query;
    if (!/(^https?:\/\/|ytsearch:|scsearch:|spotify:)/i.test(query)) {
      searchQuery = `ytsearch:${query}`;
    }
    try {
      const res = await this.manager.search(searchQuery, guildId);
      return res;
    } catch (err) {
      logger.error('search error', err as Error);
      throw err;
    }
  }

  // Enqueue resolved tracks and persist metadata (thumbnail, duration)
  public async enqueueResolved(guildId: string, resolved: any, requesterId: string) {
    const q = await this.getOrCreateQueue(guildId);
    const pushed: IQueuedTrack[] = [];
    if (resolved.playlist && Array.isArray(resolved.tracks)) {
      for (const t of resolved.tracks) {
        const qt: IQueuedTrack = {
          title: t.title,
          uri: t.uri,
          author: t.author,
          duration: t.duration,
          thumbnail: (t.thumbnail || t.displayThumbnail || (t.info && (t.info.thumbnail || t.info.image))),
          requesterId,
        };
        q.tracks.push(qt);
        pushed.push(qt);
      }
    } else if (Array.isArray(resolved.tracks) && resolved.tracks.length) {
      const t = resolved.tracks[0];
      const qt: IQueuedTrack = {
        title: t.title,
        uri: t.uri,
        author: t.author,
        duration: t.duration,
        thumbnail: (t.thumbnail || t.displayThumbnail || (t.info && (t.info.thumbnail || t.info.image))),
        requesterId,
      };
      q.tracks.push(qt);
      pushed.push(qt);
    }
    await q.save();
    return pushed;
  }

  public async enqueue(guildId: string, track: IQueuedTrack) {
    const q = await this.getOrCreateQueue(guildId);
    q.tracks.push(track);
    await q.save();
    return q;
  }

  public async getQueue(guildId: string) {
    return MusicQueueModel.findOne({ guildId }).lean().exec();
  }

  public async play(guildId: string, voiceChannel: VoiceBasedChannel, requesterId: string) {
    const q = await this.getOrCreateQueue(guildId);
    if (!q.tracks.length || q.position >= q.tracks.length) throw new Error('Queue empty');

    let player = this.manager.players.get(guildId);
    if (!player) {
      player = this.manager.create({
        guild: guildId,
        voiceChannel: voiceChannel.id,
        textChannel: voiceChannel.id,
        deaf: true,
      });
    } else {
      if (player.voiceChannel !== voiceChannel.id) {
        player.voiceChannel = voiceChannel.id;
        await player.connect();
      }
    }

    const current = q.tracks[q.position];
    try {
      await player.play(current.uri);
      musicPlays.inc();
      return { player, track: current };
    } catch (err) {
      // fallback: attempt to search and replace
      try {
        const res = await this.search(guildId, current.uri);
        if (res && res.tracks && res.tracks.length) {
          const t = res.tracks[0];
          current.uri = t.uri;
          current.title = t.title;
          current.author = t.author;
          current.duration = t.duration;
          current.thumbnail = t.thumbnail || (t.info && (t.info.thumbnail || t.info.image));
          await q.save();
          await player.play(t.uri);
          musicPlays.inc();
          return { player, track: current };
        }
      } catch (e) {
        logger.error('play fallback search error', e as Error);
      }
      throw err;
    }
  }

  public async skip(guildId: string) {
    const q = await this.getOrCreateQueue(guildId);
    if (q.tracks.length === 0) throw new Error('Queue empty');
    if (q.position + 1 < q.tracks.length) {
      q.position += 1;
      await q.save();
      musicSkips.inc();
      const player = this.manager.players.get(guildId);
      if (player) player.play(q.tracks[q.position].uri);
      return q.tracks[q.position];
    } else {
      q.position = q.tracks.length;
      await q.save();
      const player = this.manager.players.get(guildId);
      if (player) {
        player.stop();
        player.destroy();
      }
      return null;
    }
  }

  public async stopAndClear(guildId: string) {
    await MusicQueueModel.deleteOne({ guildId }).exec();
    const player = this.manager.players.get(guildId);
    if (player) {
      player.stop();
      player.destroy();
    }
    return true;
  }

  public async shuffle(guildId: string) {
    const q = await this.getOrCreateQueue(guildId);
    const rest = q.tracks.splice(q.position);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    q.tracks = q.tracks.slice(0, q.position).concat(rest);
    await q.save();
    return q;
  }

  public async setVolume(guildId: string, volume: number) {
    const player = this.manager.players.get(guildId);
    if (player) {
      player.setVolume(volume);
      return true;
    }
    return false;
  }
}