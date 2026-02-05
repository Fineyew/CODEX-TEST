import { Client, Message } from 'discord.js';
import { Command } from '../core/Bot';

const pingCommand: Command = {
  name: 'ping',
  description: 'Responds with pong & latency',
  execute: async (client: Client, message: Message) => {
    const start = Date.now();
    const m = await message.channel.send('Pong...');
    const latency = Date.now() - start;
    await m.edit(`Pong — API Latency: ${Math.round(client.ws.ping)} ms | RTT: ${latency} ms`);
  },
};

export default pingCommand;