import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType =
  | 'deposit'
  | 'purchase'
  | 'refund'
  | 'withdrawal'
  | 'profit_credit'
  | 'referral_credit'
  | 'adjustment';

export interface IWalletTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['deposit', 'purchase', 'refund', 'withdrawal', 'profit_credit', 'referral_credit', 'adjustment'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reference: String,
    description: { type: String, required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  walletTransactionSchema
);
