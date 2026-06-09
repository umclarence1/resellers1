import { Setting } from '../models/Setting';
import { Network } from '../models/Package';
import { User } from '../models/User';
import { Complaint } from '../models/Complaint';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '../utils/helpers';

const COMPLAINT_MIN_HOURS = 2;
const COMPLAINT_MAX_HOURS = 24;

export interface ComplaintOrderContext {
  orderId: string;
  network: string;
  status: string;
  createdAt: Date;
}

export const getSettings = async () => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      serviceImages: [
        { network: 'MTN', imageUrl: '/images/mtn.jpg', isAvailable: true },
        { network: 'Telecel', imageUrl: '/images/telecel.jpg', isAvailable: true },
        { network: 'AirtelTigo', imageUrl: '/images/airteltigo.jpg', isAvailable: true },
      ],
    });
  }
  return settings;
};

export const isComplaintsEnabledForUser = async (userId: string): Promise<boolean> => {
  const settings = await getSettings();
  const user = await User.findById(userId);
  if (!settings.complaintSettings.globalEnabled) return false;
  if (user?.complaintEnabled === false) return false;
  const userOverride = settings.complaintSettings.userOverrides.get(userId);
  if (userOverride === false) return false;
  return true;
};

export const canSubmitComplaint = async (
  userId: string,
  order: ComplaintOrderContext
): Promise<{ allowed: boolean; reason?: string; hoursSinceOrder?: number }> => {
  const settings = await getSettings();
  const user = await User.findById(userId);
  const hoursSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);

  if (!settings.complaintSettings.globalEnabled) {
    return { allowed: false, reason: 'Complaints are currently disabled by admin', hoursSinceOrder };
  }

  if (user?.complaintEnabled === false) {
    return { allowed: false, reason: 'Complaints disabled for your account', hoursSinceOrder };
  }

  const userOverride = settings.complaintSettings.userOverrides.get(userId);
  if (userOverride === false) {
    return { allowed: false, reason: 'Complaints disabled for your account', hoursSinceOrder };
  }

  if (order.status === 'delivered') {
    return { allowed: false, reason: 'Data already received — no complaint needed', hoursSinceOrder };
  }

  if (['refunded', 'cancelled'].includes(order.status)) {
    return { allowed: false, reason: 'This order is closed', hoursSinceOrder };
  }

  if (hoursSinceOrder < COMPLAINT_MIN_HOURS) {
    const waitMins = Math.ceil((COMPLAINT_MIN_HOURS - hoursSinceOrder) * 60);
    return {
      allowed: false,
      reason: `Wait ${waitMins} more minute${waitMins === 1 ? '' : 's'} — complaints open 2 hours after order`,
      hoursSinceOrder,
    };
  }

  if (hoursSinceOrder > COMPLAINT_MAX_HOURS) {
    return { allowed: false, reason: 'Complaint window expired (24 hours)', hoursSinceOrder };
  }

  const networkEnabled =
    settings.complaintSettings.networkSettings[order.network as Network] !== false;
  if (!networkEnabled) {
    return { allowed: false, reason: `Complaints disabled for ${order.network}`, hoursSinceOrder };
  }

  const existing = await Complaint.findOne({ orderId: order.orderId });
  if (existing) {
    return { allowed: false, reason: 'Complaint already submitted', hoursSinceOrder };
  }

  return { allowed: true, hoursSinceOrder };
};

export const depositWithdrawalPool = async (amount: number, note?: string) => {
  if (!amount || amount <= 0) throw new AppError('Amount must be greater than zero');
  const settings = await getSettings();
  const rounded = roundMoney(amount);
  settings.withdrawalPoolBalance = roundMoney((settings.withdrawalPoolBalance || 0) + rounded);
  settings.totalPoolDeposits = roundMoney((settings.totalPoolDeposits || 0) + rounded);
  await settings.save();
  return { settings, amount: rounded, note };
};

export const debitWithdrawalPool = async (amount: number) => {
  const settings = await getSettings();
  const rounded = roundMoney(amount);
  if ((settings.withdrawalPoolBalance || 0) < rounded) {
    throw new AppError('Insufficient withdrawal pool balance. Add funds in Settings first.');
  }
  settings.withdrawalPoolBalance = roundMoney(settings.withdrawalPoolBalance - rounded);
  await settings.save();
  return settings;
};

export const validatePackagePrices = (prices: {
  costPrice?: number;
  dealerPrice?: number;
  resellerBasePrice?: number;
  maxSellingPrice?: number;
}) => {
  const { costPrice, dealerPrice, resellerBasePrice, maxSellingPrice } = prices;
  const fields = [costPrice, dealerPrice, resellerBasePrice, maxSellingPrice].filter((v) => v !== undefined);
  if (fields.some((v) => typeof v !== 'number' || v <= 0)) {
    throw new AppError('All prices must be positive numbers');
  }
  if (costPrice !== undefined && dealerPrice !== undefined && dealerPrice < costPrice) {
    throw new AppError('Dealer price cannot be below cost price');
  }
  if (dealerPrice !== undefined && resellerBasePrice !== undefined && resellerBasePrice < dealerPrice) {
    throw new AppError('Reseller base price must be at least the dealer price');
  }
  if (resellerBasePrice !== undefined && maxSellingPrice !== undefined && maxSellingPrice < resellerBasePrice) {
    throw new AppError('Max sell price must be at least the reseller base price');
  }
};
