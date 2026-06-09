import { WalletTransaction } from '../models/WalletTransaction';
import { creditWallet } from './walletService';
import { fulfillStorePurchase } from './orderService';
import { createNotification } from './notificationService';

export type PaystackFulfillmentResult =
  | { type: 'wallet_deposit'; alreadyProcessed: boolean }
  | { type: 'customer_purchase'; storeSlug?: string; orderId?: string; alreadyProcessed: boolean }
  | { type: 'unknown' };

export async function processPaystackSuccess(
  reference: string,
  metadata: Record<string, unknown>,
  customerEmail?: string,
  paidAmount?: number
): Promise<PaystackFulfillmentResult> {
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
    const order = await fulfillStorePurchase(reference, metadata, customerEmail);
    return {
      type: 'customer_purchase',
      storeSlug: metadata.storeSlug as string | undefined,
      orderId: order.orderId,
      alreadyProcessed: false,
    };
  }

  return { type: 'unknown' };
}
