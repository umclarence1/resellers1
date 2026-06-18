import mongoose, { Document, Schema } from 'mongoose';
import { Network } from './Package';

export interface IComplaintSettings {
  globalEnabled: boolean;
  networkSettings: Record<Network, boolean>;
  userOverrides: Map<string, boolean>;
  activeNotice?: string;
  noticeOverridesComplaints: boolean;
}

export interface IReferralSettings {
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  isEnabled: boolean;
}

export interface IServiceImage {
  network: Network;
  imageUrl: string;
  isAvailable: boolean;
}

export type FulfillmentProvider = 'smartdatahub' | 'datamax';
export type FulfillmentNetworkRoute = 'default' | FulfillmentProvider | 'off';

export interface IFulfillmentSettings {
  /** Master switch — when false, no orders are sent to the external API */
  enabled: boolean;
  defaultProvider: FulfillmentProvider;
  networkRouting: Record<Network, FulfillmentNetworkRoute>;
}

export interface ISetting extends Document {
  processingFeePercent: number;
  paystackChargePercent: number;
  minWithdrawal: number;
  withdrawalPoolBalance: number;
  totalPoolDeposits: number;
  complaintSettings: IComplaintSettings;
  referralSettings: IReferralSettings;
  fulfillmentSettings: IFulfillmentSettings;
  serviceImages: IServiceImage[];
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    processingFeePercent: { type: Number, default: 2 },
    paystackChargePercent: { type: Number, default: 2 },
    minWithdrawal: { type: Number, default: 30 },
    withdrawalPoolBalance: { type: Number, default: 0 },
    totalPoolDeposits: { type: Number, default: 0 },
    complaintSettings: {
      globalEnabled: { type: Boolean, default: true },
      networkSettings: {
        MTN: { type: Boolean, default: true },
        Telecel: { type: Boolean, default: true },
        AirtelTigo: { type: Boolean, default: true },
      },
      userOverrides: { type: Map, of: Boolean, default: {} },
      activeNotice: String,
      noticeOverridesComplaints: { type: Boolean, default: false },
    },
    referralSettings: {
      commissionType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
      commissionValue: { type: Number, default: 5 },
      isEnabled: { type: Boolean, default: true },
    },
    fulfillmentSettings: {
      enabled: { type: Boolean, default: true },
      defaultProvider: { type: String, enum: ['smartdatahub', 'datamax'], default: 'smartdatahub' },
      networkRouting: {
        MTN: { type: String, enum: ['default', 'smartdatahub', 'datamax', 'off'], default: 'off' },
        Telecel: { type: String, enum: ['default', 'smartdatahub', 'datamax', 'off'], default: 'off' },
        AirtelTigo: { type: String, enum: ['default', 'smartdatahub', 'datamax', 'off'], default: 'off' },
      },
    },
    serviceImages: [
      {
        network: {
          type: String,
          enum: ['MTN', 'Telecel', 'AirtelTigo'],
        },
        imageUrl: String,
        isAvailable: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const Setting = mongoose.model<ISetting>('Setting', settingSchema);
