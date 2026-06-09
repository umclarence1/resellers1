import mongoose from 'mongoose';
import { Wallet } from '../models/Wallet';
import { Withdrawal, MobileMoneyNetwork } from '../models/Withdrawal';
import { WalletTransaction } from '../models/WalletTransaction';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, isValidGhanaPhone } from '../utils/helpers';
import { getSettings, debitWithdrawalPool } from './settingsService';
import { getOrCreateWallet } from './walletService';

const MAX_PENDING_WITHDRAWALS = 3;
const MOBILE_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'] as const;

export function parseWithdrawalAmount(raw: unknown): number {
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new AppError('Invalid withdrawal amount');
  }
  const amount = roundMoney(num);
  if (amount <= 0) throw new AppError('Withdrawal amount must be greater than zero');
  if (Math.abs(num - amount) > 0.001) {
    throw new AppError('Amount can have at most 2 decimal places');
  }
  return amount;
}

export async function getWithdrawalSummary(userId: mongoose.Types.ObjectId | string) {
  const wallet = await getOrCreateWallet(userId);
  const settings = await getSettings();
  const pendingCount = await Withdrawal.countDocuments({ userId, status: 'pending' });

  return {
    available: wallet.profitBalance,
    reserved: wallet.withdrawalReserved ?? 0,
    minWithdrawal: settings.minWithdrawal,
    pendingCount,
    maxPending: MAX_PENDING_WITHDRAWALS,
  };
}

/** Lock earnings when a reseller requests withdrawal — prevents double-spend. */
export async function reserveWithdrawalFunds(
  userId: mongoose.Types.ObjectId | string,
  amount: number
) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId, profitBalance: { $gte: amount } },
    {
      $inc: {
        profitBalance: -amount,
        withdrawalReserved: amount,
      },
    },
    { new: true }
  );

  if (!wallet) {
    throw new AppError('Insufficient withdrawable earnings');
  }

  return wallet;
}

export async function releaseWithdrawalFunds(
  userId: mongoose.Types.ObjectId | string,
  amount: number
) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId, withdrawalReserved: { $gte: amount } },
    {
      $inc: {
        withdrawalReserved: -amount,
        profitBalance: amount,
      },
    },
    { new: true }
  );

  if (!wallet) {
    throw new AppError('Could not release reserved earnings');
  }

  return wallet;
}

export async function finalizeWithdrawalFunds(
  userId: mongoose.Types.ObjectId | string,
  amount: number
) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId, withdrawalReserved: { $gte: amount } },
    {
      $inc: {
        withdrawalReserved: -amount,
        totalWithdrawals: amount,
      },
    },
    { new: true }
  );

  if (!wallet) {
    throw new AppError('Withdrawal reserve mismatch — contact support');
  }

  return wallet;
}

export async function requestWithdrawal(
  userId: mongoose.Types.ObjectId | string,
  input: {
    amount: unknown;
    network: string;
    mobileNumber: string;
    accountName: string;
  }
) {
  const settings = await getSettings();
  const amount = parseWithdrawalAmount(input.amount);

  if (amount < settings.minWithdrawal) {
    throw new AppError(`Minimum withdrawal is GHS ${settings.minWithdrawal}`);
  }

  if (!MOBILE_NETWORKS.includes(input.network as (typeof MOBILE_NETWORKS)[number])) {
    throw new AppError('Invalid mobile money network');
  }
  if (!isValidGhanaPhone(input.mobileNumber)) {
    throw new AppError('Invalid mobile money number');
  }
  const accountName = input.accountName?.trim();
  if (!accountName) throw new AppError('Account name is required');

  const pendingCount = await Withdrawal.countDocuments({ userId, status: 'pending' });
  if (pendingCount >= MAX_PENDING_WITHDRAWALS) {
    throw new AppError('Too many pending requests. Wait for admin to review existing ones.');
  }

  await reserveWithdrawalFunds(userId, amount);

  try {
    return await Withdrawal.create({
      userId,
      amount,
      network: input.network as MobileMoneyNetwork,
      mobileNumber: input.mobileNumber,
      accountName,
      fundsReserved: true,
    });
  } catch (err) {
    await releaseWithdrawalFunds(userId, amount);
    throw err;
  }
}

export async function approveWithdrawal(withdrawalId: string) {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) throw new AppError('Withdrawal not found');
  if (withdrawal.status !== 'pending') {
    throw new AppError('Withdrawal already processed');
  }

  const amount = withdrawal.amount;
  const settings = await getSettings();
  if ((settings.withdrawalPoolBalance || 0) < amount) {
    throw new AppError('Insufficient withdrawal pool balance. Add funds in Settings first.');
  }

  let wallet;
  if (withdrawal.fundsReserved) {
    wallet = await finalizeWithdrawalFunds(withdrawal.userId, amount);
  } else {
    // Legacy pending request (before reservation was enforced)
    wallet = await Wallet.findOneAndUpdate(
      { userId: withdrawal.userId, profitBalance: { $gte: amount } },
      { $inc: { profitBalance: -amount, totalWithdrawals: amount } },
      { new: true }
    );
    if (!wallet) {
      throw new AppError('Insufficient withdrawable earnings for this request');
    }
  }

  try {
    await debitWithdrawalPool(amount);
  } catch (err) {
    if (withdrawal.fundsReserved) {
      await Wallet.findOneAndUpdate(
        { userId: withdrawal.userId },
        { $inc: { withdrawalReserved: amount, totalWithdrawals: -amount } }
      );
    } else {
      await Wallet.findOneAndUpdate(
        { userId: withdrawal.userId },
        { $inc: { profitBalance: amount, totalWithdrawals: -amount } }
      );
    }
    throw err;
  }

  await WalletTransaction.create({
    userId: withdrawal.userId,
    type: 'withdrawal',
    amount: -amount,
    balanceBefore: roundMoney(wallet.profitBalance + amount),
    balanceAfter: wallet.profitBalance,
    reference: withdrawal._id.toString(),
    description: `Withdrawal approved: GHS ${amount}`,
    metadata: { withdrawalId: withdrawal._id, network: withdrawal.network },
  });

  withdrawal.status = 'approved';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  return withdrawal;
}

export async function rejectWithdrawal(withdrawalId: string, adminNote?: string) {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) throw new AppError('Withdrawal not found');
  if (withdrawal.status !== 'pending') {
    throw new AppError('Withdrawal already processed');
  }

  if (withdrawal.fundsReserved) {
    await releaseWithdrawalFunds(withdrawal.userId, withdrawal.amount);
  }

  withdrawal.status = 'rejected';
  if (adminNote) withdrawal.adminNote = adminNote;
  await withdrawal.save();

  return withdrawal;
}

export async function markWithdrawalPaid(withdrawalId: string) {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) throw new AppError('Withdrawal not found');
  if (withdrawal.status !== 'approved') {
    throw new AppError('Only approved withdrawals can be marked paid');
  }

  withdrawal.status = 'paid';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  return withdrawal;
}

/** Reserve funds for pending withdrawals created before reservation was enforced. */
export async function reconcileLegacyPendingWithdrawals() {
  const legacy = await Withdrawal.find({ status: 'pending', fundsReserved: { $ne: true } });
  let fixed = 0;

  for (const w of legacy) {
    try {
      await reserveWithdrawalFunds(w.userId, w.amount);
      w.fundsReserved = true;
      await w.save();
      fixed++;
    } catch {
      // Insufficient balance — leave for admin to reject manually
    }
  }

  if (fixed > 0) {
    console.log(`Withdrawal security: reserved funds for ${fixed} legacy pending request(s)`);
  }
}
