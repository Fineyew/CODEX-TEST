import mongoose, { Schema, Document } from 'mongoose';

export interface IModLog extends Document {
  guildId: string;
  type: string;
  userId: string;
  moderatorId?: string;
  reason?: string;
  duration?: number; // seconds for timeouts
  createdAt?: Date;
}

const ModLogSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, default: null },
  reason: { type: String, default: null },
  duration: { type: Number, default: null },
}, { timestamps: true });

export default mongoose.model<IModLog>('ModLog', ModLogSchema);