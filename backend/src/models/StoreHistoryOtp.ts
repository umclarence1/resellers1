import mongoose, { Document, Schema } from 'mongoose';

export interface IStoreHistoryOtp extends Document {
  storeSlug: string;
  identifier: string;
  identifierType: 'email' | 'phone';
  otpEmail: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const storeHistoryOtpSchema = new Schema<IStoreHistoryOtp>(
  {
    storeSlug: { type: String, required: true, lowercase: true },
    identifier: { type: String, required: true },
    identifierType: { type: String, enum: ['email', 'phone'], required: true },
    otpEmail: { type: String, required: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

storeHistoryOtpSchema.index({ storeSlug: 1, identifier: 1 });
storeHistoryOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StoreHistoryOtp = mongoose.model<IStoreHistoryOtp>('StoreHistoryOtp', storeHistoryOtpSchema);
