import { Manager, Node, Track } from '@erela.js/core';
import Spotify from '@erela.js/spotify';
import logger from '../../logger';

export default class MusicManager {
  public manager: Manager | null = null;
  constructor(public bot: any) {}

  public init() {
    const nodes = [
      {
        identifier: 'local',
        host: process.env.LAVALINK_HOST || '127.0.0.1',
        port: Number(process.env.LAVALINK_PORT || 2333),
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      },
    ];

    const clientID = process.env.CLIENT_ID || undefined;
    const clientSecret = process.env.CLIENT_SECRET || undefined;

    // instantiate manager
    this.manager = new Manager({
      nodes,
      send: (id, payload) => {
        const guild = this.bot.client.guilds.cache.get(id.split(':')[0]);
        if (guild) {
          // @ts-ignore
          this.bot.client.ws.shards[guild.shardId].send(payload);
        }
      },
    });

    // optional: Spotify plugin for erela
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        // @ts-ignore - types for plugin
        this.manager.use(Spotify({ clientID: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET }));
      } catch (e) {
        logger.error('Spotify plugin failed to load: ' + (e as Error).message);
      }
    }

    this.manager.on('nodeConnect', (node: Node) => logger.info(`Lavalink node connected: ${node.options.identifier}`));
    this.manager.on('nodeError', (node: Node, err: Error) => logger.error(`Lavalink node error ${node.options.identifier}: ${err.message}`));
    this.manager.on('trackError', (player, track: Track, payload) => logger.error(`Track error ${track?.title}`));

    // bind discord events to manager
    this.bot.client.on('raw', (packet) => {
      // forward voice websocket packets to erela manager
      if ((packet.t === 'VOICE_SERVER_UPDATE' || packet.t === 'VOICE_STATE_UPDATE') && this.manager) {
        this.manager.updateVoiceState(packet.d);
      }
    });

    logger.info('Music manager initialized');
  }
}