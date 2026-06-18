import axios from 'axios';
import { env } from '../config/env';
import { Network } from '../models/Package';
import { parseBundleDataSizeGb } from './smartDataHubClient';

export class DatamaxError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function mapNetworkToDatamaxCode(network: Network | string): string {
  const map: Record<string, string> = {
    MTN: 'express',
    Telecel: 'telecel',
    AirtelTigo: 'airteltigo',
  };
  return map[network] || String(network).toLowerCase();
}

export function mapDatamaxVolume(bundleSize: string): string {
  return String(parseBundleDataSizeGb(bundleSize));
}

export function isDatamaxConfigured(): boolean {
  return Boolean(env.datamax.enabled && env.datamax.apiUrl && env.datamax.apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function datamaxRequest<T>(
  method: 'GET' | 'POST',
  relativePath: string,
  options?: { body?: unknown; params?: Record<string, string> }
): Promise<T> {
  if (!env.datamax.apiKey) {
    throw new DatamaxError('Datamax API credentials not configured', 0);
  }

  const baseUrl = env.datamax.apiUrl.replace(/\/$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-KEY': env.datamax.apiKey,
  };

  let lastError: DatamaxError | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);

    const res = await axios.request({
      method,
      url,
      headers,
      params: options?.params,
      data: options?.body,
      timeout: 25000,
      validateStatus: () => true,
    });

    if (res.status === 429) {
      lastError = new DatamaxError('Datamax rate limit exceeded — retrying', 429);
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      return res.data as T;
    }

    const errBody = res.data as { message?: string; error?: string };
    throw new DatamaxError(
      errBody.message || errBody.error || `Datamax API error (${res.status})`,
      res.status
    );
  }

  throw lastError || new DatamaxError('Datamax API unavailable', 503);
}

export interface DatamaxPlaceOrderResponse {
  success: boolean;
  message?: string;
  order_id?: number;
  total?: number;
}

export interface DatamaxOrderStatusResponse {
  success: boolean;
  status?: string;
  message?: string;
  order_id?: number;
}

export interface DatamaxBalanceResponse {
  success: boolean;
  balance?: number;
  wallet_balance?: number;
  message?: string;
}

export async function createDatamaxOrder(input: {
  orderId: string;
  recipientPhone: string;
  network: Network | string;
  bundleSize: string;
}): Promise<DatamaxPlaceOrderResponse> {
  const payload = {
    request_id: input.orderId,
    network: mapNetworkToDatamaxCode(input.network),
    volume: mapDatamaxVolume(input.bundleSize),
    customer_number: input.recipientPhone,
    quantity: 1,
  };

  return datamaxRequest<DatamaxPlaceOrderResponse>('POST', '/place_order', { body: payload });
}

export async function fetchDatamaxOrderStatus(providerOrderId: string): Promise<DatamaxOrderStatusResponse> {
  return datamaxRequest<DatamaxOrderStatusResponse>('GET', '/order_status', {
    params: { order_id: providerOrderId },
  });
}

export async function checkDatamaxBalance(): Promise<DatamaxBalanceResponse> {
  return datamaxRequest<DatamaxBalanceResponse>('GET', '/check_balance');
}

export async function testDatamaxConnection(): Promise<{ message: string; balance?: number }> {
  const res = await checkDatamaxBalance();
  const balance = res.balance ?? res.wallet_balance;
  return {
    message: res.message || 'Datamax connection successful',
    balance,
  };
}

export interface DatamaxAfaRegisterResponse {
  success?: boolean;
  message?: string;
  order_id?: number | string;
  registration_id?: number | string;
}

export async function registerDatamaxAfa(input: {
  fullName: string;
  phone: string;
  ghanaCard: string;
  location: string;
  occupation?: string;
}): Promise<DatamaxAfaRegisterResponse> {
  if (!env.datamax.apiKey) {
    throw new DatamaxError('Datamax API credentials not configured', 0);
  }

  const baseUrl = env.datamax.apiUrl.replace(/\/wp-json\/api\/v1\/?$/, '').replace(/\/$/, '');
  const url = `${baseUrl}/wp-json/afa/v1/register`;

  const payload = {
    api_key: env.datamax.apiKey,
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    ghana_card: input.ghanaCard.trim().toUpperCase(),
    location: input.location.trim(),
    occupation: input.occupation?.trim() || 'Farmer',
  };

  let lastError: DatamaxError | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);

    const res = await axios.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: payload,
      timeout: 25000,
      validateStatus: () => true,
    });

    if (res.status === 429) {
      lastError = new DatamaxError('Datamax rate limit exceeded — retrying', 429);
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      return res.data as DatamaxAfaRegisterResponse;
    }

    const errBody = res.data as { message?: string; error?: string };
    throw new DatamaxError(
      errBody.message || errBody.error || `Datamax AFA API error (${res.status})`,
      res.status
    );
  }

  throw lastError || new DatamaxError('Datamax AFA API unavailable', 503);
}
