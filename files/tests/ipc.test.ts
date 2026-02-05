import IPCManager from '../src/core/IPCManager';
import redisMock from 'ioredis-mock';
import * as redisClient from '../src/core/redisClient';

// replace real redis with mock for test
jest.mock('../src/core/redisClient', () => require('ioredis-mock').createClient());

describe('IPCManager', () => {
  test('request/response roundtrip', async () => {
    const a = new IPCManager('test:ipc:');
    const b = new IPCManager('test:ipc:');

    b.on('ping', async (payload: any) => {
      return { pong: payload };
    });

    const res = await a.request('ping', { hello: 'world' }, 2000);
    expect(res).toEqual({ pong: { hello: 'world' } });
  }, 10000);
});