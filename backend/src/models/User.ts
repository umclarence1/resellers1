import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'dealer' | 'reseller';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface IResellerStore {
  storeName: string;
  slug: string;
  phone: string;
  whatsapp: string;
  supportEmail: string;
  isActive: boolean;
  isVerified: boolean;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  customPrices: Map<string, number>;
}

export interface IDealerApi {
  apiKey: string;
  secretKey: string;
  ipWhitelist: string[];
  webhookUrl?: string;
  isActive: boolean;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  resellerStore?: IResellerStore;
  dealerApi?: IDealerApi;
  complaintEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resellerStoreSchema = new Schema<IResellerStore>(
  {
    storeName: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, required: true },
    supportEmail: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    referralCode: { type: String, required: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    customPrices: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const dealerApiSchema = new Schema<IDealerApi>(
  {
    apiKey: { type: String, required: true },
    secretKey: { type: String, required: true },
    ipWhitelist: { type: [String], default: [] },
    webhookUrl: String,
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'dealer', 'reseller'], required: true },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
    resellerStore: resellerStoreSchema,
    dealerApi: dealerApiSchema,
    complaintEnabled: { type: Boolean, default: true },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ 'resellerStore.slug': 1 }, { unique: true, sparse: true });
userSchema.index({ 'resellerStore.referralCode': 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
