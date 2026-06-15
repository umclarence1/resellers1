import { verifyPayment } from '../utils/paystack';
import { roundMoney } from '../utils/helpers';

export interface PaystackWebhookCharge {
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

/**
 * Server-side verification before crediting wallets or creating orders.
 * Rejects mismatched references, amounts, currencies, and statuses.
 */
export async function verifyPaystackChargeBeforeFulfillment(
  reference: string,
  webhookData: PaystackWebhookCharge,
  metadata: Record<string, unknown>
) {
  const verified = await verifyPayment(reference);

  if (verified.status !== 'success') {
    throw new Error(`Paystack transaction status is ${verified.status}, expected success`);
  }

  if (verified.currency && verified.currency !== 'GHS') {
    throw new Error(`Currency mismatch: expected GHS, got ${verified.currency}`);
  }

  if (webhookData.currency && webhookData.currency !== 'GHS') {
    throw new Error(`Webhook currency mismatch: ${webhookData.currency}`);
  }

  const verifiedRef = String(verified.reference || '');
  if (verifiedRef && verifiedRef !== reference) {
    throw new Error('Paystack reference mismatch between webhook and verification API');
  }

  if (webhookData.reference && String(webhookData.reference) !== reference) {
    throw new Error('Webhook reference does not match expected reference');
  }

  const expectedGhs = Number(metadata.expectedTotal ?? metadata.depositAmount);
  if (!expectedGhs || !Number.isFinite(expectedGhs)) {
    throw new Error('Payment metadata missing expected amount');
  }

  const verifiedGhs = roundMoney(Number(verified.amount) / 100);
  const webhookGhs =
    webhookData.amount !== undefined ? roundMoney(Number(webhookData.amount) / 100) : verifiedGhs;

  if (Math.abs(roundMoney(expectedGhs) - verifiedGhs) > 0.02) {
    throw new Error(
      `Verified amount mismatch: expected GHS ${expectedGhs}, Paystack reports GHS ${verifiedGhs}`
    );
  }

  if (Math.abs(verifiedGhs - webhookGhs) > 0.02) {
    throw new Error(
      `Webhook amount mismatch: webhook GHS ${webhookGhs}, verified GHS ${verifiedGhs}`
    );
  }

  if (webhookData.status && webhookData.status !== 'success') {
    throw new Error(`Webhook reports non-success status: ${webhookData.status}`);
  }

  return verified;
}
