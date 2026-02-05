import mongoose, { Schema, Document } from 'mongoose';

export interface ITimedAction extends Document {
  guildId: string;
  type: string; // e.g., 'timeout_remove'
  targetId: string; // user id
  runAt: Date;
  createdBy?: string;
  meta?: any;
  executed?: boolean;
  createdAt?: Date;
}

const TimedActionSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  targetId: { type: String, required: true },
  runAt: { type: Date, required: true, index: true },
  createdBy: { type: String, default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
  executed: { type: Boolean, default: false, index: true },
}, { timestamps: true });

export default mongoose.model<ITimedAction>('TimedAction', TimedActionSchema);