import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminActionOtp extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const adminActionOtpSchema = new Schema<IAdminActionOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminActionOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminActionOtp = mongoose.model<IAdminActionOtp>('AdminActionOtp', adminActionOtpSchema);
