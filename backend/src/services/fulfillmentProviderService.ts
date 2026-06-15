import crypto from 'crypto';
import mongoose from 'mongoose';
import { secureCompare } from '../utils/secureCompare';
import { Order, IOrder, OrderStatus } from '../models/Order';
import { env } from '../config/env';
import { createNotification } from './notificationService';
import { notifyagentWebhook } from './agentWebhookService';
import { creditWallet } from './walletService';
import { isFulfillmentRoutingEnabledForNetwork } from './settingsService';
import {
  SmartDataHubError,
  createSmartDataHubOrder,
  fetchSmartDataHubBulkStatus,
  isSmartDataHubConfigured,
} from './smartDataHubClient';

export interface StatusHistoryEntry {
  step: string;
  label: string;
  message: string;
  done: boolean;
  at: Date;
}

const QUEUED_PROVIDER_STATUSES = ['awaiting_provider_balance', 'submit_failed'] as const;

/** Strip third-party provider names from text shown to agents and resellers. */
export function sanitizeClientFulfillmentText(text: string): string {
  return text
    .replace(/smart\s*data\s*hub/gi, 'network')
    .replace(/smartdatahub[^\s]*/gi, 'network')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function clientStepMessage(message: string): string {
  const sanitized = sanitizeClientFulfillmentText(message);
  if (/api credentials not configured|api error/i.test(sanitized)) {
    return 'Gateway processing in progress';
  }
  return sanitized;
}

export const mapProviderStatus = (raw: string): OrderStatus => {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  if (['delivered', 'completed', 'success', 'successful'].includes(s)) return 'delivered';
  if (['failed', 'error', 'rejected'].includes(s)) return 'failed';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['refunded'].includes(s)) return 'refunded';
  if (['pending', 'awaiting', 'created', 'awaiting_provider_balance'].includes(s)) return 'pending';
  return 'processing';
};

export const displayProviderStatus = (providerStatus?: string, status?: OrderStatus): string => {
  if (!providerStatus) return status || 'pending';
  const labels: Record<string, string> = {
    submitting_to_api: 'submitting_to_api',
    submitting: 'submitting_to_api',
    gateway_processing: 'gateway_processing',
    awaiting_provider_balance: 'awaiting_provider_balance',
    in_progress: 'processing',
  };
  return labels[providerStatus.toLowerCase()] || providerStatus;
};

function pushHistory(order: IOrder, entry: Omit<StatusHistoryEntry, 'at'> & { at?: Date }) {
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    ...entry,
    at: entry.at || new Date(),
  });
}

function isSubmittedToProvider(order: IOrder): boolean {
  return Boolean(order.providerBatchId || order.providerReference);
}

export function buildDefaultHistory(order: IOrder): StatusHistoryEntry[] {
  const paid =
    order.source === 'reseller_store' || order.source === 'agent' || order.source === 'agent_api';
  const submitted = isSubmittedToProvider(order);
  const queued = order.providerStatus === 'awaiting_provider_balance';
  const processing = ['processing', 'delivered'].includes(order.status);
  const delivered = order.status === 'delivered';
  const failed = ['failed', 'cancelled', 'refunded'].includes(order.status);

  return [
    {
      step: 'created',
      label: 'Order Created',
      message: `Request received for ${order.recipientPhone}`,
      done: true,
      at: order.createdAt,
    },
    {
      step: 'payment',
      label: 'Payment Processing',
      message: order.source === 'reseller_store' ? 'Payment verified' : 'Wallet debited',
      done: paid,
      at: order.createdAt,
    },
    {
      step: 'gateway',
      label: queued
        ? 'Awaiting Provider Balance'
        : order.providerStatus === 'submitting_to_api'
          ? 'Submitting to API'
          : 'Gateway Processing',
      message: queued
        ? 'Queued — processing will resume shortly'
        : order.providerStatus === 'submitting_to_api'
          ? 'Sending order to the network'
          : 'Verifying with telecommunication provider',
      done: submitted || processing || delivered,
      at: order.updatedAt,
    },
    {
      step: 'dispatch',
      label: 'Bundle Dispatched',
      message: failed ? 'Delivery could not be completed' : 'Resource sent to recipient',
      done: delivered,
      at: order.updatedAt,
    },
    {
      step: 'confirmation',
      label: 'Final Confirmation',
      message: delivered
        ? 'End-to-end receipt validated'
        : failed
          ? 'Order marked as not delivered'
          : 'Awaiting delivery confirmation',
      done: delivered,
      at: order.updatedAt,
    },
  ];
}

export function getOrderTracking(order: IOrder, options?: { forClient?: boolean }) {
  const forClient = options?.forClient ?? false;
  const steps =
    order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory.map((h) => ({
          step: h.step,
          label: h.label,
          message: forClient ? clientStepMessage(h.message) : h.message,
          done: h.done,
          at: h.at,
        }))
      : buildDefaultHistory(order).map((h) => ({
          ...h,
          message: forClient ? clientStepMessage(h.message) : h.message,
        }));

  return {
    orderId: order.orderId,
    status: order.status,
    providerStatus: forClient ? undefined : order.providerStatus,
    providerOrderId: forClient ? undefined : order.providerOrderId,
    providerBatchId: forClient ? undefined : order.providerBatchId,
    providerReference: forClient ? undefined : order.providerReference,
    recipientPhone: order.recipientPhone,
    network: order.network,
    bundleSize: order.bundleSize,
    sellingPrice: order.sellingPrice,
    totalAmount: order.totalAmount,
    steps,
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
  };
}

async function notifyStatusChange(order: IOrder, prevStatus: OrderStatus) {
  if (order.status === prevStatus) return;

  if (order.resellerId && order.status === 'delivered') {
    if (order.profit > 0) {
      await creditWallet(
        order.resellerId,
        order.profit,
        'profit_credit',
        `Profit from order ${order.orderId}`,
        order.orderId
      );
    }
    await createNotification(
      order.resellerId,
      'order_delivered',
      'Order Delivered',
      `Order ${order.orderId} has been delivered successfully.`
    );
  }
  if (order.agentId && order.status === 'delivered') {
    await createNotification(
      order.agentId,
      'order_delivered',
      'Order Delivered',
      `Order ${order.orderId} has been delivered successfully.`
    );
  }
  if (order.agentId && ['delivered', 'failed'].includes(order.status)) {
    await notifyagentWebhook(order);
  }
}

export async function applyOrderStatusUpdate(
  order: IOrder,
  update: {
    status?: OrderStatus;
    providerStatus?: string;
    providerOrderId?: string;
    providerBatchId?: string;
    providerReference?: string;
    stepLabel?: string;
    stepMessage?: string;
  }
) {
  const prevStatus = order.status;

  if (update.providerOrderId) order.providerOrderId = update.providerOrderId;
  if (update.providerBatchId) order.providerBatchId = update.providerBatchId;
  if (update.providerReference) order.providerReference = update.providerReference;
  if (update.providerStatus) order.providerStatus = update.providerStatus;
  if (update.status) order.status = update.status;

  if (update.stepLabel || update.stepMessage || update.providerStatus || update.status) {
    pushHistory(order, {
      step: update.providerStatus || update.status || 'update',
      label: update.stepLabel || update.providerStatus || update.status || 'Status Update',
      message: update.stepMessage || `Status updated to ${update.status || order.status}`,
      done: ['delivered', 'failed', 'cancelled', 'refunded'].includes(order.status),
    });
  }

  await order.save();
  await notifyStatusChange(order, prevStatus);
  return order;
}

export async function submitOrderToProvider(order: IOrder): Promise<IOrder | null> {
  if (!isSmartDataHubConfigured()) return null;
  if (!(await isFulfillmentRoutingEnabledForNetwork(order.network))) return null;

  if (isSubmittedToProvider(order) && !QUEUED_PROVIDER_STATUSES.includes(
    order.providerStatus as (typeof QUEUED_PROVIDER_STATUSES)[number]
  )) {
    return order;
  }

  try {
    const response = await createSmartDataHubOrder({
      orderId: order.orderId,
      recipientPhone: order.recipientPhone,
      network: order.network,
      bundleSize: order.bundleSize,
    });

    const data = response.data;
    return applyOrderStatusUpdate(order, {
      status: 'processing',
      providerStatus: 'gateway_processing',
      providerBatchId: data.batch_id,
      providerOrderId: data.batch_id,
      providerReference: data.order_number || order.orderId,
      stepLabel: 'Gateway Processing',
      stepMessage: data.message ? clientStepMessage(data.message) : 'Order submitted for processing',
    });
  } catch (err) {
    if (err instanceof SmartDataHubError && err.statusCode === 402) {
      return applyOrderStatusUpdate(order, {
        providerStatus: 'awaiting_provider_balance',
        stepLabel: 'Awaiting Provider Balance',
        stepMessage: 'Queued — processing will resume shortly',
      });
    }

    console.error('Smart Data Hub submit failed:', err instanceof Error ? err.message : err);
    return applyOrderStatusUpdate(order, {
      providerStatus: 'submit_failed',
      stepLabel: 'Gateway Processing',
      stepMessage:
        err instanceof SmartDataHubError
          ? clientStepMessage(err.message)
          : 'Could not reach fulfillment gateway — retrying automatically',
    });
  }
}

function resolveBulkStatus(data: {
  status?: string;
  orders?: { status?: string }[];
}): string {
  if (data.status) return data.status;
  const orders = data.orders || [];
  if (orders.length === 0) return '';
  if (orders.every((o) => o.status === 'delivered')) return 'completed';
  if (orders.some((o) => o.status === 'failed')) return 'failed';
  return orders[0]?.status || 'processing';
}

export async function syncOrderFromProvider(order: IOrder): Promise<IOrder | null> {
  if (!isSmartDataHubConfigured()) return null;
  if (!(await isFulfillmentRoutingEnabledForNetwork(order.network))) return order;
  if (['delivered', 'failed', 'cancelled', 'refunded'].includes(order.status)) return order;

  if (
    !isSubmittedToProvider(order) ||
    QUEUED_PROVIDER_STATUSES.includes(
      order.providerStatus as (typeof QUEUED_PROVIDER_STATUSES)[number]
    )
  ) {
    return submitOrderToProvider(order);
  }

  const ref = order.providerReference || order.orderId;
  try {
    const response = await fetchSmartDataHubBulkStatus(ref);
    const payload = response.data;
    const rawStatus = resolveBulkStatus(payload);
    if (!rawStatus) return order;

    const line = payload.orders?.[0];
    return applyOrderStatusUpdate(order, {
      status: mapProviderStatus(rawStatus),
      providerStatus: rawStatus.toLowerCase().replace(/\s+/g, '_'),
      providerBatchId: payload.batch_id || order.providerBatchId,
      providerOrderId: line?.id || order.providerOrderId,
      providerReference: payload.order_number || order.providerReference,
      stepLabel: 'Gateway Processing',
      stepMessage: `Delivery status: ${rawStatus}`,
    });
  } catch (err) {
    if (err instanceof SmartDataHubError && err.statusCode === 404) {
      return submitOrderToProvider(order);
    }
    return order;
  }
}

export async function retryQueuedFulfillmentOrders(limit = 30): Promise<number> {
  if (!isSmartDataHubConfigured()) return 0;

  const queued = await Order.find({
    providerStatus: { $in: [...QUEUED_PROVIDER_STATUSES] },
    status: { $in: ['pending', 'processing'] },
    $or: [{ providerBatchId: { $exists: false } }, { providerBatchId: null }, { providerBatchId: '' }],
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let retried = 0;
  for (const order of queued) {
    if (!(await isFulfillmentRoutingEnabledForNetwork(order.network))) continue;
    await submitOrderToProvider(order);
    retried++;
  }
  return retried;
}

export type FulfillmentScope = {
  agentId?: mongoose.Types.ObjectId | string;
  resellerId?: mongoose.Types.ObjectId | string;
};

function scopeFilter(scope: FulfillmentScope = {}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (scope.agentId) filter.agentId = scope.agentId;
  if (scope.resellerId) filter.resellerId = scope.resellerId;
  return filter;
}

/** Pull latest Smart Data Hub statuses into MongoDB before dashboards/lists render. */
export async function syncFulfillmentStatuses(scope: FulfillmentScope = {}, limit = 50) {
  await retryQueuedFulfillmentOrders(Math.min(limit, 30));

  const orders = await Order.find({
    ...scopeFilter(scope),
    status: { $in: ['pending', 'processing'] },
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

  for (const order of orders) {
    await syncOrderFromProvider(order);
  }
}

export async function getFulfillmentStatusCounts(scope: FulfillmentScope = {}) {
  const base = scopeFilter(scope);
  const [awaitingProviderBalance, submittingToApi] = await Promise.all([
    Order.countDocuments({
      ...base,
      providerStatus: 'awaiting_provider_balance',
      status: { $in: ['pending', 'processing'] },
    }),
    Order.countDocuments({
      ...base,
      providerStatus: { $in: ['submitting_to_api', 'gateway_processing', 'submit_failed'] },
      status: { $in: ['pending', 'processing'] },
    }),
  ]);
  return { awaitingProviderBalance, submittingToApi };
}

export async function syncInFlightOrders(orders: IOrder[]) {
  await retryQueuedFulfillmentOrders();

  const inFlight = orders.filter((o) => ['pending', 'processing'].includes(o.status)).slice(0, 20);
  for (const order of inFlight) {
    await syncOrderFromProvider(order);
  }
}

export function verifyFulfillmentWebhookSignature(payload: string, signature: string): boolean {
  if (!env.fulfillment.webhookSecret) return env.nodeEnv !== 'production';
  const hash = crypto
    .createHmac('sha256', env.fulfillment.webhookSecret)
    .update(payload)
    .digest('hex');
  return secureCompare(hash, signature);
}

export async function handleFulfillmentWebhook(body: Record<string, unknown>) {
  const reference = String(
    body.reference ||
      body.orderId ||
      body.order_id ||
      body.order_number ||
      body.external_reference ||
      ''
  );
  const providerRef = String(
    body.provider_reference || body.api_reference || body.order_api_reference || body.id || ''
  );
  if (!reference && !providerRef) throw new Error('Missing order reference');

  const order = await Order.findOne({
    $or: [
      { orderId: reference },
      { providerOrderId: reference },
      { providerReference: reference },
      { providerBatchId: reference },
      ...(providerRef
        ? [
            { providerReference: providerRef },
            { providerOrderId: providerRef },
            { providerBatchId: providerRef },
          ]
        : []),
    ],
  });

  if (!order) throw new Error('Order not found');

  const rawStatus = String(body.status || body.order_status || '');
  if (!rawStatus) return order;

  return applyOrderStatusUpdate(order, {
    status: mapProviderStatus(rawStatus),
    providerStatus: rawStatus.toLowerCase().replace(/\s+/g, '_'),
    providerOrderId: String(body.provider_order_id || body.order_id || order.providerOrderId || ''),
    providerBatchId: String(body.batch_id || order.providerBatchId || ''),
    providerReference: String(
      body.provider_reference || body.order_api_reference || order.providerReference || ''
    ),
    stepLabel: 'Gateway Processing',
    stepMessage: `Provider update: ${rawStatus}`,
  });
}
