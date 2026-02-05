import mongoose from 'mongoose';
import MusicQueueModel from '../src/models/MusicQueue';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dynobot_test', {});
  await MusicQueueModel.deleteMany({}).exec();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

test('create music queue with metadata', async () => {
  const q = new MusicQueueModel({ guildId: 'tg1', tracks: [], position: 0 });
  await q.save();
  q.tracks.push({ title: 'Track A', uri: 'yt:abc', requesterId: 'u1', duration: 123000, thumbnail: 'http://img' });
  await q.save();
  const fetched = await MusicQueueModel.findOne({ guildId: 'tg1' }).lean().exec();
  expect(fetched).not.toBeNull();
  expect(fetched!.tracks[0].duration).toBe(123000);
  expect(fetched!.tracks[0].thumbnail).toBe('http://img');
});