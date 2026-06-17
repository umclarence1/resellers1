import mongoose, { Document, Schema } from 'mongoose';
import { Network } from './Package';
import { generateOrderNumber } from '../utils/helpers';
import { isValidOrderStatus, normalizeOrderStatus } from '../utils/orderStatus';

export type OrderStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'refunded' | 'cancelled';
export type OrderSource = 'agent' | 'agent_api' | 'reseller_store' | 'admin';

export interface IOrderStatusHistory {
  step: string;
  label: string;
  message: string;
  done: boolean;
  at: Date;
}

export interface IOrder extends Document {
  orderId: string;
  /** Legacy field — kept in sync with orderId for production unique index (orderNumber_1). */
  orderNumber: string;
  userId?: mongoose.Types.ObjectId;
  resellerId?: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  customerEmail?: string;
  network: Network;
  bundleSize: string;
  packageId: mongoose.Types.ObjectId;
  recipientPhone: string;
  costPrice: number;
  adminBasePrice?: number;
  sellingPrice: number;
  profit: number;
  platformProfit: number;
  paystackFee: number;
  processingFee: number;
  totalAmount: number;
  status: OrderStatus;
  source: OrderSource;
  paystackReference?: string;
  providerOrderId?: string;
  providerBatchId?: string;
  providerReference?: string;
  providerStatus?: string;
  statusHistory?: IOrderStatusHistory[];
  complaintDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function assignOrderIdentifiers(doc: {
  orderId?: string;
  orderNumber?: string;
}): void {
  if (!isBlank(doc.orderNumber) && isBlank(doc.orderId)) {
    doc.orderId = String(doc.orderNumber).trim();
    return;
  }
  if (!isBlank(doc.orderId) && isBlank(doc.orderNumber)) {
    doc.orderNumber = String(doc.orderId).trim();
    return;
  }
  if (isBlank(doc.orderId) && isBlank(doc.orderNumber)) {
    const id = generateOrderNumber();
    doc.orderId = id;
    doc.orderNumber = id;
  }
}

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: generateOrderNumber,
    },
    orderNumber: {
      type: String,
      required: true,
      default: generateOrderNumber,
      validate: {
        validator: (value: string) => !isBlank(value),
        message: 'orderNumber cannot be null, undefined, or empty',
      },
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    resellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    agentId: { type: Schema.Types.ObjectId, ref: 'User' },
    customerEmail: String,
    network: { type: String, required: true },
    bundleSize: { type: String, required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    recipientPhone: { type: String, required: true },
    costPrice: { type: Number, required: true },
    adminBasePrice: { type: Number },
    sellingPrice: { type: Number, required: true },
    profit: { type: Number, default: 0 },
    platformProfit: { type: Number, default: 0 },
    paystackFee: { type: Number, default: 0 },
    processingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['agent', 'agent_api', 'reseller_store', 'admin'],
      required: true,
    },
    paystackReference: String,
    providerOrderId: String,
    providerBatchId: String,
    providerReference: String,
    providerStatus: String,
    statusHistory: [
      {
        step: String,
        label: String,
        message: String,
        done: Boolean,
        at: Date,
      },
    ],
    complaintDeadline: { type: Date, required: true },
  },
  { timestamps: true }
);

orderSchema.pre('validate', function () {
  assignOrderIdentifiers(this);
  if (!isValidOrderStatus(this.status)) {
    this.status = normalizeOrderStatus(this.status, this.providerStatus);
  }
});

orderSchema.pre('save', function () {
  assignOrderIdentifiers(this);
});

orderSchema.index({ orderId: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
orderSchema.index({ resellerId: 1, createdAt: -1 });
orderSchema.index({ agentId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1, agentId: 1 });
orderSchema.index({ status: 1, createdAt: -1, resellerId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ resellerId: 1, customerEmail: 1, source: 1 });
orderSchema.index({ resellerId: 1, recipientPhone: 1, source: 1 });
orderSchema.index({ providerStatus: 1, status: 1, createdAt: 1 });
orderSchema.index({ paystackReference: 1 }, { unique: true, sparse: true });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
