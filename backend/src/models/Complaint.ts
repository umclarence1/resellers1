import mongoose, { Document, Schema } from 'mongoose';

export type ComplaintStatus = 'pending' | 'under_review' | 'resolved' | 'rejected' | 'refunded';
export type IssueType =
  | 'Data Not Received'
  | 'Wrong Bundle'
  | 'Wrong Number'
  | 'Delayed Delivery'
  | 'Other';

export interface IComplaint extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId;
  phoneNumber: string;
  issueType: IssueType;
  description: string;
  screenshotUrl?: string;
  status: ComplaintStatus;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    orderId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    phoneNumber: { type: String, required: true },
    issueType: {
      type: String,
      enum: ['Data Not Received', 'Wrong Bundle', 'Wrong Number', 'Delayed Delivery', 'Other'],
      required: true,
    },
    description: { type: String, required: true },
    screenshotUrl: String,
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved', 'rejected', 'refunded'],
      default: 'pending',
    },
    adminResponse: String,
  },
  { timestamps: true }
);

complaintSchema.index({ orderId: 1 });
complaintSchema.index({ userId: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });

export const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);
