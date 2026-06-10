import mongoose, { Document, Schema } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';
export type MobileMoneyNetwork = 'MTN' | 'Telecel' | 'AirtelTigo';

export interface IWithdrawal extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  network: MobileMoneyNetwork;
  mobileNumber: string;
  accountName: string;
  status: WithdrawalStatus;
  adminNote?: string;
  fundsReserved: boolean;
  paystackTransferCode?: string;
  paystackTransferReference?: string;
  paystackTransferStatus?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 30 },
    network: { type: String, enum: ['MTN', 'Telecel', 'AirtelTigo'], required: true },
    mobileNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected'],
      default: 'pending',
    },
    adminNote: String,
    fundsReserved: { type: Boolean, default: false },
    paystackTransferCode: String,
    paystackTransferReference: String,
    paystackTransferStatus: String,
    processedAt: Date,
  },
  { timestamps: true }
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
