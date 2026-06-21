import mongoose, { Document, Schema } from 'mongoose';

export type PromoCodeStatus = 'active' | 'used' | 'disabled' | 'expired';

export interface IPromoCode extends Document {
  codeHash: string;
  codeLast4: string;
  packageId: mongoose.Types.ObjectId;
  discountGhs: number;
  batchId: string;
  label?: string;
  status: PromoCodeStatus;
  expiresAt?: Date;
  usedAt?: Date;
  usedByEmail?: string;
  orderId?: string;
  paystackReference?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const promoCodeSchema = new Schema<IPromoCode>(
  {
    codeHash: { type: String, required: true, unique: true },
    codeLast4: { type: String, required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    discountGhs: { type: Number, required: true, min: 0.01 },
    batchId: { type: String, required: true, index: true },
    label: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'used', 'disabled', 'expired'],
      default: 'active',
    },
    expiresAt: { type: Date },
    usedAt: { type: Date },
    usedByEmail: { type: String, lowercase: true, trim: true },
    orderId: { type: String },
    paystackReference: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

promoCodeSchema.index({ packageId: 1, status: 1 });
promoCodeSchema.index({ batchId: 1, status: 1 });
promoCodeSchema.index({ createdAt: -1 });

export const PromoCode = mongoose.model<IPromoCode>('PromoCode', promoCodeSchema);
