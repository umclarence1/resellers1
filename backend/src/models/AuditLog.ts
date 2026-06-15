import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    details: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const IMMUTABLE_MSG = 'Audit logs are append-only and cannot be modified or deleted';

function blockAuditMutation(this: mongoose.Query<unknown, unknown>) {
  throw new Error(IMMUTABLE_MSG);
}

auditLogSchema.pre(
  ['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'replaceOne'],
  blockAuditMutation
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
