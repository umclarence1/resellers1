import mongoose, { Document, Schema } from 'mongoose';
import type { ComplaintStatus, IssueType } from './Complaint';

export interface ICustomerComplaint extends Document {
  orderId: string;
  resellerId: mongoose.Types.ObjectId;
  storeSlug: string;
  customerEmail?: string;
  recipientPhone: string;
  issueType: IssueType;
  description: string;
  status: ComplaintStatus;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerComplaintSchema = new Schema<ICustomerComplaint>(
  {
    orderId: { type: String, required: true, unique: true },
    resellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeSlug: { type: String, required: true, lowercase: true },
    customerEmail: { type: String, lowercase: true, trim: true },
    recipientPhone: { type: String, required: true },
    issueType: {
      type: String,
      enum: ['Data Not Received', 'Wrong Bundle', 'Wrong Number', 'Delayed Delivery', 'Other'],
      required: true,
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved', 'rejected', 'refunded'],
      default: 'pending',
    },
    adminResponse: String,
  },
  { timestamps: true }
);

customerComplaintSchema.index({ resellerId: 1, createdAt: -1 });
customerComplaintSchema.index({ status: 1, createdAt: -1 });
customerComplaintSchema.index({ storeSlug: 1, createdAt: -1 });

export const CustomerComplaint = mongoose.model<ICustomerComplaint>(
  'CustomerComplaint',
  customerComplaintSchema
);
