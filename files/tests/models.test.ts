import mongoose from 'mongoose';
import CustomCommandModel from '../src/models/CustomCommand';
import ModLogModel from '../src/models/ModLog';
import MusicQueueModel from '../src/models/MusicQueue';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dynobot_test', {});
  await CustomCommandModel.deleteMany({}).exec();
  await ModLogModel.deleteMany({}).exec();
  await MusicQueueModel.deleteMany({}).exec();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

test('custom command CRUD and retrieval', async () => {
  const cmd = new CustomCommandModel({ guildId: 'g1', name: 'hello', response: 'Hi {user}', creatorId: 'u1' });
  await cmd.save();
  const fetched = await CustomCommandModel.findOne({ guildId: 'g1', name: 'hello' }).lean().exec();
  expect(fetched).not.toBeNull();
  expect(fetched!.response).toBe('Hi {user}');
  await CustomCommandModel.deleteOne({ guildId: 'g1', name: 'hello' }).exec();
  const after = await CustomCommandModel.findOne({ guildId: 'g1', name: 'hello' }).lean().exec();
  expect(after).toBeNull();
});

test('modlog creation', async () => {
  const log = new ModLogModel({ guildId: 'g1', type: 'warn', userId: 'u2', moderatorId: 'm1', reason: 'test' });
  await log.save();
  const f = await ModLogModel.findOne({ guildId: 'g1', type: 'warn' }).lean().exec();
  expect(f).not.toBeNull();
  expect(f!.reason).toBe('test');
});

test('music queue persist metadata', async () => {
  const q = new MusicQueueModel({ guildId: 'gq1', tracks: [{ title: 'T', uri: 'u', duration: 1000, thumbnail: 't.jpg', requesterId: 'r1' }], position: 0 });
  await q.save();
  const f = await MusicQueueModel.findOne({ guildId: 'gq1' }).lean().exec();
  expect(f).not.toBeNull();
  expect(f!.tracks.length).toBe(1);
  expect(f!.tracks[0].thumbnail).toBe('t.jpg');
});