import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'wallet_funded'
  | 'order_delivered'
  | 'order_failed'
  | 'complaint_updated'
  | 'withdrawal_approved'
  | 'withdrawal_paid'
  | 'withdrawal_rejected'
  | 'referral_registered'
  | 'agent_api_request'
  | 'agent_api_approved'
  | 'agent_api_rejected'
  | 'system';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'wallet_funded',
        'order_delivered',
        'order_failed',
        'complaint_updated',
        'withdrawal_approved',
        'withdrawal_paid',
        'withdrawal_rejected',
        'referral_registered',
        'agent_api_request',
        'agent_api_approved',
        'agent_api_rejected',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
