import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomCommand extends Document {
  guildId: string;
  name: string; // trigger name
  response: string; // template
  regex?: boolean;
  allowEveryone?: boolean;
  allowedRoles?: string[];
  creatorId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomCommandSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  regex: { type: Boolean, default: false },
  allowEveryone: { type: Boolean, default: true },
  allowedRoles: { type: [String], default: [] },
  creatorId: { type: String, default: null },
}, { timestamps: true });

CustomCommandSchema.index({ guildId: 1, name: 1 }, { unique: true });

export default mongoose.model<ICustomCommand>('CustomCommand', CustomCommandSchema);