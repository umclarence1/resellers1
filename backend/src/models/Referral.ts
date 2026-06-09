import mongoose, { Document, Schema } from 'mongoose';

export interface IReferral extends Document {
  referrerId: mongoose.Types.ObjectId;
  referredId: mongoose.Types.ObjectId;
  commissionEarned: number;
  isActive: boolean;
  createdAt: Date;
}

const referralSchema = new Schema<IReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commissionEarned: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredId: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', referralSchema);
