import mongoose from 'mongoose';
import request from 'supertest';
import { apiApp } from '../src/api/server';
import redisMock from 'ioredis-mock';
import * as redisClient from '../src/core/redisClient';
import jwt from 'jsonwebtoken';
import GuildModel from '../src/models/Guild';

jest.mock('../src/core/redisClient', () => {
  const mock = require('ioredis-mock').createClient();
  return mock;
});

const JWT_SECRET = process.env.JWT_SECRET || 'replace_in_production';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dynobot_test', {});
  await GuildModel.deleteMany({}).exec();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

test('auth middleware denies without token', async () => {
  const res = await request(apiApp).get('/api/guilds/1234');
  expect(res.status).toBe(401);
});

test('auth + put/get guild config flow', async () => {
  // create a fake JWT and session in redis mock
  const token = jwt.sign({ id: 'u1', username: 'tester', adminGuilds: ['g1'] }, JWT_SECRET, { expiresIn: '2h' });
  const r = require('../src/core/redisClient');
  await r.set(`session:${token}`, JSON.stringify({ id: 'u1', username: 'tester' }), 'EX', 3600);

  // PUT update guild
  const patch = { prefix: '?' };
  const put = await request(apiApp).put('/api/guilds/g1').set('Authorization', `Bearer ${token}`).send(patch);
  expect(put.status).toBe(200);
  expect(put.body.guild._id).toBe('g1');
  expect(put.body.guild.prefix).toBe('?');

  // GET guild
  const get = await request(apiApp).get('/api/guilds/g1').set('Authorization', `Bearer ${token}`);
  expect(get.status).toBe(200);
  expect(get.body.guild._id).toBe('g1');
});

test('module toggle endpoint toggles', async () => {
  const token = jwt.sign({ id: 'u1', username: 'tester', adminGuilds: ['g2'] }, JWT_SECRET, { expiresIn: '2h' });
  const r = require('../src/core/redisClient');
  await r.set(`session:${token}`, JSON.stringify({ id: 'u1', username: 'tester' }), 'EX', 3600);

  // toggle on
  const resOn = await request(apiApp).post('/api/guilds/g2/modules/toggle?module=testmod').set('Authorization', `Bearer ${token}`).send();
  expect(resOn.status).toBe(200);
  expect(resOn.body.enabled).toBe(true);

  // toggle off
  const resOff = await request(apiApp).post('/api/guilds/g2/modules/toggle?module=testmod').set('Authorization', `Bearer ${token}`).send();
  expect(resOff.status).toBe(200);
  expect(resOff.body.enabled).toBe(false);
});