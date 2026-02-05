import mongoose, { Schema, Document } from 'mongoose';

export interface IModMail extends Document {
  guildId: string;
  userId: string;
  channelId: string; // channel in server where ticket exists
  open: boolean;
  createdAt?: Date;
}

const ModMailSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  open: { type: Boolean, default: true },
}, { timestamps: true });

ModMailSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IModMail>('ModMail', ModMailSchema);