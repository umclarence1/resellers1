import mongoose, { Document, Schema } from 'mongoose';
import { Network } from './Package';

export type OrderStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'refunded' | 'cancelled';
export type OrderSource = 'dealer' | 'dealer_api' | 'reseller_store' | 'admin';

export interface IOrder extends Document {
  orderId: string;
  userId?: mongoose.Types.ObjectId;
  resellerId?: mongoose.Types.ObjectId;
  dealerId?: mongoose.Types.ObjectId;
  customerEmail?: string;
  network: Network;
  bundleSize: string;
  packageId: mongoose.Types.ObjectId;
  recipientPhone: string;
  costPrice: number;
  sellingPrice: number;
  profit: number;
  processingFee: number;
  totalAmount: number;
  status: OrderStatus;
  source: OrderSource;
  paystackReference?: string;
  complaintDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    resellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    dealerId: { type: Schema.Types.ObjectId, ref: 'User' },
    customerEmail: String,
    network: { type: String, required: true },
    bundleSize: { type: String, required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    recipientPhone: { type: String, required: true },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    profit: { type: Number, default: 0 },
    processingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['dealer', 'dealer_api', 'reseller_store', 'admin'],
      required: true,
    },
    paystackReference: String,
    complaintDeadline: { type: Date, required: true },
  },
  { timestamps: true }
);

orderSchema.index({ orderId: 1 });
orderSchema.index({ resellerId: 1, createdAt: -1 });
orderSchema.index({ dealerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ resellerId: 1, customerEmail: 1, source: 1 });
orderSchema.index({ resellerId: 1, recipientPhone: 1, source: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
