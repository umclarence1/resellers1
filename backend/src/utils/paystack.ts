import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';

const paystackApi = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${env.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
});

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export const initializePayment = async (
  email: string,
  amountInPesewas: number,
  metadata: Record<string, unknown>
): Promise<PaystackInitResponse> => {
  const { data } = await paystackApi.post('/transaction/initialize', {
    email,
    amount: amountInPesewas,
    currency: 'GHS',
    callback_url: `${env.frontendUrl}/payment/callback`,
    metadata,
  });

  return data.data;
};

export const verifyPayment = async (reference: string) => {
  const { data } = await paystackApi.get(`/transaction/verify/${reference}`);
  return data.data;
};

export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  const hash = crypto
    .createHmac('sha512', env.paystack.secretKey)
    .update(payload)
    .digest('hex');
  return hash === signature;
};

export const calculatePaystackCharge = (amount: number, chargePercent: number): number => {
  return Math.round(amount * (chargePercent / 100) * 100) / 100;
};

/** Ghana MoMo provider codes for Paystack transfer recipients */
export const MOBILE_MONEY_BANK_CODES: Record<string, string> = {
  MTN: 'MTN',
  Telecel: 'VOD',
  AirtelTigo: 'TGL',
};

export const ghsToPesewas = (amount: number): number => Math.round(amount * 100);

export const pesewasToGhs = (amount: number): number => amount / 100;

export const createTransferRecipient = async (input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) => {
  const { data } = await paystackApi.post('/transferrecipient', {
    type: 'mobile_money',
    name: input.name,
    account_number: input.accountNumber,
    bank_code: input.bankCode,
    currency: 'GHS',
  });
  return data.data as { recipient_code: string };
};

export const initiateTransfer = async (input: {
  amountInPesewas: number;
  recipientCode: string;
  reason: string;
  reference: string;
}) => {
  const { data } = await paystackApi.post('/transfer', {
    source: 'balance',
    amount: input.amountInPesewas,
    recipient: input.recipientCode,
    reason: input.reason,
    reference: input.reference,
    currency: 'GHS',
  });
  return data.data as { transfer_code: string; status: string; reference: string };
};

export const verifyTransfer = async (reference: string) => {
  const { data } = await paystackApi.get(`/transfer/verify/${reference}`);
  return data.data;
};
