import mongoose, { Document, Schema } from 'mongoose';
import { CheckerType } from '../config/checker';

export type ResultCheckerStatus = 'available' | 'assigned';

export interface IResultChecker extends Document {
  type: CheckerType;
  serial: string;
  pin: string;
  status: ResultCheckerStatus;
  orderId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  uploadBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const resultCheckerSchema = new Schema<IResultChecker>(
  {
    type: { type: String, enum: ['bece', 'wassce'], required: true },
    serial: { type: String, required: true, trim: true },
    pin: { type: String, required: true, trim: true },
    status: { type: String, enum: ['available', 'assigned'], default: 'available' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    assignedAt: Date,
    uploadBatchId: String,
  },
  { timestamps: true }
);

resultCheckerSchema.index({ type: 1, serial: 1 }, { unique: true });
resultCheckerSchema.index({ type: 1, status: 1 });
resultCheckerSchema.index({ orderId: 1 }, { sparse: true });

export const ResultChecker = mongoose.model<IResultChecker>('ResultChecker', resultCheckerSchema);
