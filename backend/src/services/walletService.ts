import mongoose from 'mongoose';
import { Wallet } from '../models/Wallet';
import { WalletTransaction, TransactionType } from '../models/WalletTransaction';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '../utils/helpers';

export const getOrCreateWallet = async (userId: mongoose.Types.ObjectId | string) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId });
  }
  return wallet;
};

export const creditWallet = async (
  userId: mongoose.Types.ObjectId | string,
  amount: number,
  type: TransactionType,
  description: string,
  reference?: string,
  metadata?: Record<string, unknown>
) => {
  const wallet = await getOrCreateWallet(userId);
  const roundedAmount = roundMoney(amount);
  const balanceBefore = wallet.balance;
  wallet.balance = roundMoney(wallet.balance + roundedAmount);

  if (type === 'deposit') {
    wallet.totalDeposits = roundMoney(wallet.totalDeposits + roundedAmount);
  }
  if (type === 'profit_credit') {
    wallet.profitBalance = roundMoney(wallet.profitBalance + roundedAmount);
  }
  if (type === 'referral_credit') {
    wallet.referralEarnings = roundMoney(wallet.referralEarnings + roundedAmount);
  }

  await wallet.save();

  await WalletTransaction.create({
    userId,
    type,
    amount: roundedAmount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference,
    description,
    metadata,
  });

  return wallet;
};

export const debitWallet = async (
  userId: mongoose.Types.ObjectId | string,
  amount: number,
  type: TransactionType,
  description: string,
  reference?: string,
  metadata?: Record<string, unknown>
) => {
  const wallet = await getOrCreateWallet(userId);
  const roundedAmount = roundMoney(amount);

  if (wallet.balance < roundedAmount) {
    throw new AppError('Insufficient wallet balance');
  }

  const balanceBefore = wallet.balance;
  wallet.balance = roundMoney(wallet.balance - roundedAmount);
  await wallet.save();

  await WalletTransaction.create({
    userId,
    type,
    amount: -roundedAmount,
    balanceBefore,
    balanceAfter: wallet.balance,
    reference,
    description,
    metadata,
  });

  return wallet;
};

export const debitProfitBalance = async (
  userId: mongoose.Types.ObjectId | string,
  amount: number
) => {
  const wallet = await getOrCreateWallet(userId);
  const roundedAmount = roundMoney(amount);

  if (wallet.profitBalance < roundedAmount) {
    throw new AppError('Insufficient withdrawable profit');
  }

  wallet.profitBalance = roundMoney(wallet.profitBalance - roundedAmount);
  wallet.totalWithdrawals = roundMoney(wallet.totalWithdrawals + roundedAmount);
  await wallet.save();

  return wallet;
};
