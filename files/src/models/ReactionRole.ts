import mongoose, { Schema, Document } from 'mongoose';

export interface IReactionRole extends Document {
  guildId: string;
  messageId: string;
  emoji: string;
  roleId: string;
  createdAt?: Date;
}

const ReactionRoleSchema: Schema = new Schema({
  guildId: { type: String, required: true, index: true },
  messageId: { type: String, required: true, index: true },
  emoji: { type: String, required: true },
  roleId: { type: String, required: true },
}, { timestamps: true });

ReactionRoleSchema.index({ guildId: 1, messageId: 1, emoji: 1 }, { unique: true });

export default mongoose.model<IReactionRole>('ReactionRole', ReactionRoleSchema);