import crypto from 'crypto';
import { initializePayment, calculatePaystackCharge, ghsToPesewas } from '../utils/paystack';
import { getSettings } from './settingsService';
import { roundMoney } from '../utils/helpers';

export type PaystackPaymentType = 'wallet_deposit' | 'customer_purchase' | 'pool_deposit';

export async function initWalletDepositPayment(email: string, userId: string, amount: number) {
  const settings = await getSettings();
  const charge = calculatePaystackCharge(amount, settings.paystackChargePercent);
  const total = roundMoney(amount + charge);
  const reference = `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payment = await initializePayment(email, ghsToPesewas(total), {
    type: 'wallet_deposit',
    userId,
    depositAmount: amount,
    paystackCharge: charge,
    expectedTotal: total,
    reference,
  });

  return {
    authorizationUrl: payment.authorization_url,
    reference: payment.reference,
    depositAmount: amount,
    paystackCharge: charge,
    total,
  };
}

export async function initPoolDepositPayment(email: string, adminId: string, amount: number, note?: string) {
  const rounded = roundMoney(amount);
  const reference = `POOL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payment = await initializePayment(email, ghsToPesewas(rounded), {
    type: 'pool_deposit',
    adminId,
    depositAmount: rounded,
    note: note || '',
    expectedTotal: rounded,
    reference,
  });

  return {
    authorizationUrl: payment.authorization_url,
    reference: payment.reference,
    depositAmount: rounded,
    total: rounded,
  };
}
