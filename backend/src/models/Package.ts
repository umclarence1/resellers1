import mongoose, { Document, Schema } from 'mongoose';

export type Network = 'MTN' | 'Telecel' | 'AirtelTigo';

export interface IPackage extends Document {
  network: Network;
  bundleSize: string;
  costPrice: number;
  agentPrice: number;
  resellerBasePrice: number;
  maxSellingPrice: number;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    network: {
      type: String,
      enum: ['MTN', 'Telecel', 'AirtelTigo'],
      required: true,
    },
    bundleSize: { type: String, required: true },
    costPrice: { type: Number, required: true, min: 0 },
    agentPrice: { type: Number, required: true, min: 0 },
    resellerBasePrice: { type: Number, required: true, min: 0 },
    maxSellingPrice: { type: Number, required: true, min: 0 },
    isEnabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

packageSchema.index({ network: 1, bundleSize: 1 }, { unique: true });
packageSchema.index({ network: 1, isEnabled: 1 });

export const Package = mongoose.model<IPackage>('Package', packageSchema);
