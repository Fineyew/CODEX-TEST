import mongoose, { Schema, Document } from 'mongoose';

export interface IGuild extends Document {
  _id: string; // guildId
  prefix?: string;
  modules?: string[];
  settings?: Record<string, any>;
  modRole?: string;
  djRole?: string;
  logChannel?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const GuildSchema: Schema = new Schema({
  _id: { type: String, required: true },
  prefix: { type: String, default: '!' },
  modules: { type: [String], default: [] },
  settings: { type: Schema.Types.Mixed, default: {} },
  modRole: { type: String, default: null },
  djRole: { type: String, default: null },
  logChannel: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model<IGuild>('Guild', GuildSchema);