import mongoose from 'mongoose';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { Order } from '../models/Order';
import { Complaint } from '../models/Complaint';
import { CustomerComplaint } from '../models/CustomerComplaint';
import { Withdrawal } from '../models/Withdrawal';
import { Notification } from '../models/Notification';
import { ApiLog } from '../models/ApiLog';
import { RefreshToken } from '../models/RefreshToken';
import { StoreHistoryOtp } from '../models/StoreHistoryOtp';
import { Otp } from '../models/Otp';
import { AdminActionOtp } from '../models/AdminActionOtp';
import { AuditLog } from '../models/AuditLog';
import { getSettings } from './settingsService';
import { invalidateAdminDashboardCache } from './adminDashboardService';
import { activateResellerStore } from './resellerOnboardingService';

export type ProductionResetOptions = {
  /** Remove all agents and resellers (admin accounts kept). */
  removeNonAdminUsers?: boolean;
};

export type ProductionResetSummary = {
  ordersDeleted: number;
  complaintsDeleted: number;
  customerComplaintsDeleted: number;
  withdrawalsDeleted: number;
  walletTransactionsDeleted: number;
  auditLogsDeleted: number;
  walletsReset: number;
  resellersActivated: number;
  usersRemoved: number;
  withdrawalPoolBalance: number;
};

export async function resetPlatformForProduction(
  options: ProductionResetOptions = {}
): Promise<ProductionResetSummary> {
  const [
    ordersDeleted,
    complaintsDeleted,
    customerComplaintsDeleted,
    withdrawalsDeleted,
    walletTransactionsDeleted,
    auditLogsDeleted,
  ] = await Promise.all([
    Order.deleteMany({}).then((r) => r.deletedCount ?? 0),
    Complaint.deleteMany({}).then((r) => r.deletedCount ?? 0),
    CustomerComplaint.deleteMany({}).then((r) => r.deletedCount ?? 0),
    Withdrawal.deleteMany({}).then((r) => r.deletedCount ?? 0),
    WalletTransaction.deleteMany({}).then((r) => r.deletedCount ?? 0),
    AuditLog.deleteMany({}).then((r) => r.deletedCount ?? 0),
  ]);

  await Promise.all([
    Notification.deleteMany({}),
    ApiLog.deleteMany({}),
    RefreshToken.deleteMany({}),
    StoreHistoryOtp.deleteMany({}),
    Otp.deleteMany({}),
    AdminActionOtp.deleteMany({}),
  ]);

  const walletReset = await Wallet.updateMany(
    {},
    {
      $set: {
        balance: 0,
        profitBalance: 0,
        withdrawalReserved: 0,
        referralEarnings: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
      },
    }
  );

  const settings = await getSettings();
  settings.withdrawalPoolBalance = 0;
  settings.totalPoolDeposits = 0;
  await settings.save();

  let usersRemoved = 0;
  if (options.removeNonAdminUsers) {
    const toRemove = await User.find({ role: { $ne: 'admin' } }).select('_id');
    const ids = toRemove.map((u) => u._id);
    if (ids.length) {
      await Wallet.deleteMany({ userId: { $in: ids } });
      const result = await User.deleteMany({ _id: { $in: ids } });
      usersRemoved = result.deletedCount ?? 0;
    }
  } else {
    const resellers = await User.find({ role: 'reseller' });
    for (const reseller of resellers) {
      activateResellerStore(reseller);
      await reseller.save();
    }
  }

  const resellersActivated = options.removeNonAdminUsers
    ? 0
    : await User.countDocuments({ role: 'reseller', 'resellerStore.isActive': true });

  invalidateAdminDashboardCache();

  return {
    ordersDeleted,
    complaintsDeleted,
    customerComplaintsDeleted,
    withdrawalsDeleted,
    walletTransactionsDeleted,
    auditLogsDeleted,
    walletsReset: walletReset.modifiedCount ?? 0,
    resellersActivated,
    usersRemoved,
    withdrawalPoolBalance: 0,
  };
}

export async function connectAndReset(
  mongoUri: string,
  options: ProductionResetOptions
): Promise<ProductionResetSummary> {
  await mongoose.connect(mongoUri);
  try {
    return await resetPlatformForProduction(options);
  } finally {
    await mongoose.disconnect();
  }
}
