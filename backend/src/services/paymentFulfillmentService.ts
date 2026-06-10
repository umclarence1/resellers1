import mongoose from 'mongoose';
import { WalletTransaction } from '../models/WalletTransaction';
import { AuditLog } from '../models/AuditLog';
import { Order } from '../models/Order';
import { creditWallet } from './walletService';
import { fulfillStorePurchase } from './orderService';
import { createNotification } from './notificationService';
import { depositWithdrawalPool } from './settingsService';
import { roundMoney } from '../utils/helpers';

export type PaystackFulfillmentResult =
  | { type: 'wallet_deposit'; alreadyProcessed: boolean }
  | { type: 'customer_purchase'; storeSlug?: string; orderId?: string; alreadyProcessed: boolean }
  | { type: 'pool_deposit'; alreadyProcessed: boolean; amount?: number }
  | { type: 'unknown' };

function validatePaidAmount(
  metadata: Record<string, unknown>,
  paidAmountGhs?: number
): void {
  const expected = Number(metadata.expectedTotal ?? metadata.depositAmount);
  if (!expected || paidAmountGhs === undefined) return;

  if (Math.abs(roundMoney(expected) - roundMoney(paidAmountGhs)) > 0.02) {
    throw new Error(
      `Payment amount mismatch: expected GHS ${expected}, received GHS ${paidAmountGhs}`
    );
  }
}

async function isPoolDepositProcessed(reference: string): Promise<boolean> {
  const existing = await AuditLog.findOne({
    entity: 'withdrawal_pool',
    action: 'paystack_deposit',
    'details.paystackReference': reference,
  });
  return !!existing;
}

export async function processPaystackSuccess(
  reference: string,
  metadata: Record<string, unknown>,
  customerEmail?: string,
  paidAmount?: number
): Promise<PaystackFulfillmentResult> {
  validatePaidAmount(metadata, paidAmount);

  if (metadata.type === 'wallet_deposit' && metadata.userId && metadata.depositAmount) {
    const existing = await WalletTransaction.findOne({ reference, type: 'deposit' });
    if (existing) {
      return { type: 'wallet_deposit', alreadyProcessed: true };
    }

    const depositAmount = Number(metadata.depositAmount);
    await creditWallet(
      String(metadata.userId),
      depositAmount,
      'deposit',
      `Wallet deposit of GHS ${depositAmount}`,
      reference,
      {
        paystackCharge: metadata.paystackCharge,
        totalPaid: paidAmount,
      }
    );

    await createNotification(
      String(metadata.userId),
      'wallet_funded',
      'Wallet Funded',
      `Your wallet has been credited with GHS ${depositAmount}.`
    );

    return { type: 'wallet_deposit', alreadyProcessed: false };
  }

  if (metadata.type === 'customer_purchase') {
    const existing = await Order.findOne({ paystackReference: reference });
    if (existing) {
      return {
        type: 'customer_purchase',
        storeSlug: metadata.storeSlug as string | undefined,
        orderId: existing.orderId,
        alreadyProcessed: true,
      };
    }

    const order = await fulfillStorePurchase(reference, metadata, customerEmail);
    return {
      type: 'customer_purchase',
      storeSlug: metadata.storeSlug as string | undefined,
      orderId: order.orderId,
      alreadyProcessed: false,
    };
  }

  if (metadata.type === 'pool_deposit' && metadata.depositAmount) {
    if (await isPoolDepositProcessed(reference)) {
      return { type: 'pool_deposit', alreadyProcessed: true, amount: Number(metadata.depositAmount) };
    }

    const amount = Number(metadata.depositAmount);
    const note = (metadata.note as string) || `Paystack ref ${reference}`;
    await depositWithdrawalPool(amount, note);

    await AuditLog.create({
      userId: metadata.adminId
        ? new mongoose.Types.ObjectId(String(metadata.adminId))
        : undefined,
      action: 'paystack_deposit',
      entity: 'withdrawal_pool',
      details: {
        amount,
        note,
        paystackReference: reference,
        paidAmount: paidAmount,
      },
    });

    return { type: 'pool_deposit', alreadyProcessed: false, amount };
  }

  return { type: 'unknown' };
}
