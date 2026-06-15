import mongoose, { Document, Schema } from 'mongoose';

export interface IApiLog extends Document {
  agentId: mongoose.Types.ObjectId;
  endpoint: string;
  method: string;
  statusCode: number;
  ip: string;
  requestBody?: Record<string, unknown>;
  responseTime: number;
  createdAt: Date;
}

const apiLogSchema = new Schema<IApiLog>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String, required: true },
    requestBody: Schema.Types.Mixed,
    responseTime: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

apiLogSchema.index({ agentId: 1, createdAt: -1 });

export const ApiLog = mongoose.model<IApiLog>('ApiLog', apiLogSchema);
