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
