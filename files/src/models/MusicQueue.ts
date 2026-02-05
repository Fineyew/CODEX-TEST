import mongoose, { Schema, Document } from 'mongoose';

export interface IQueuedTrack {
  title: string;
  uri: string;
  author?: string;
  duration?: number; // ms
  thumbnail?: string;
  requesterId?: string;
}

export interface IMusicQueue extends Document {
  guildId: string;
  tracks: IQueuedTrack[];
  position: number;
  loop: 'off' | 'track' | 'queue';
  createdAt?: Date;
  updatedAt?: Date;
}

const QueuedTrackSchema: Schema = new Schema({
  title: String,
  uri: String,
  author: String,
  duration: Number,
  thumbnail: String,
  requesterId: String,
}, { _id: false });

const MusicQueueSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true, unique: true },
  tracks: { type: [QueuedTrackSchema], default: [] },
  position: { type: Number, default: 0 },
  loop: { type: String, enum: ['off', 'track', 'queue'], default: 'off' },
}, { timestamps: true });

export default mongoose.model<IMusicQueue>('MusicQueue', MusicQueueSchema);