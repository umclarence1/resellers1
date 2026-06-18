import mongoose from 'mongoose';
import { Package, Network } from '../models/Package';
import { Order, OrderSource, OrderStatus } from '../models/Order';
import { Setting } from '../models/Setting';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { generateOrderId, generateOrderNumber, isValidGhanaPhone, roundMoney } from '../utils/helpers';
import { toOrderCreationError } from '../utils/mongoErrors';
import { debitWallet } from './walletService';
import { applyOrderStatusUpdate, submitOrderToProvider } from './fulfillmentProviderService';
import { snapshotPlatformProfitForOrder } from './platformProfitService';
import { getAdminBasePrice, computeResellerOrderProfit } from './profitFormulas';
import { assertNetworkInStock } from './networkStockService';
import { resolveFulfillmentProvider } from './settingsService';
import { getAgentPrice } from './agentPricingService';
import { env } from '../config/env';
import { withMongoTransaction, sessionOpts } from '../utils/mongoTransaction';
import { appendAuditLog } from './immutableAuditService';
import { normalizeGhanaPhone } from '../utils/phone';

const getSettings = async () => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({});
  }
  return settings;
};

export const getResellerPrice = async (
  resellerId: mongoose.Types.ObjectId | string,
  packageId: mongoose.Types.ObjectId | string,
  defaultPrice: number
): Promise<number> => {
  const reseller = await User.findById(resellerId);
  if (!reseller?.resellerStore?.customPrices) return defaultPrice;

  const customPrice = reseller.resellerStore.customPrices.get(packageId.toString());
  return customPrice ?? defaultPrice;
};

export const validateResellerPrice = (
  price: number,
  basePrice: number,
  maxPrice: number
): void => {
  if (price < basePrice) {
    throw new AppError(`Price cannot be below base price of GHS ${basePrice}`);
  }
  if (price > maxPrice) {
    throw new AppError('Price exceeds allowed limit.');
  }
};

export interface CreateOrderInput {
  packageId: string;
  recipientPhone: string;
  userId?: string;
  agentId?: string;
  resellerId?: string;
  customerEmail?: string;
  sellingPrice?: number;
  source: OrderSource;
  paystackReference?: string;
  processingFee?: number;
  skipWalletDebit?: boolean;
  walletReference?: string;
}

export const fulfillStorePurchase = async (
  reference: string,
  metadata: Record<string, unknown>,
  customerEmail?: string
) => {
  const existing = await Order.findOne({ paystackReference: reference });
  if (existing) return existing;

  return createOrder({
    packageId: String(metadata.packageId),
    recipientPhone: String(metadata.recipientPhone),
    resellerId: String(metadata.resellerId),
    customerEmail: (metadata.customerEmail as string) || customerEmail,
    sellingPrice: Number(metadata.sellingPrice),
    processingFee: Number(metadata.processingFee),
    source: 'reseller_store',
    paystackReference: reference,
  });
};

export const createOrder = async (input: CreateOrderInput) => {
  const pkg = await Package.findById(input.packageId);
  if (!pkg || !pkg.isEnabled) {
    throw new AppError('Package not found or disabled');
  }

  const recipientPhone = normalizeGhanaPhone(input.recipientPhone);

  if (!isValidGhanaPhone(recipientPhone)) {
    throw new AppError('Recipient number must be 10 digits starting with 0');
  }

  await assertNetworkInStock(pkg.network);

  const settings = await getSettings();
  const fulfillmentProvider = await resolveFulfillmentProvider(pkg.network);
  const apiCost = fulfillmentProvider === 'datamax' ? pkg.agentPrice : pkg.costPrice;
  let sellingPrice = input.sellingPrice ?? pkg.agentPrice;
  let profit = 0;

  const needsWalletDebit =
    (input.source === 'agent' || input.source === 'agent_api') &&
    !!input.agentId &&
    !input.skipWalletDebit;

  if (input.source === 'agent' || input.source === 'agent_api') {
    sellingPrice = input.agentId
      ? await getAgentPrice(input.agentId, pkg._id, pkg)
      : pkg.agentPrice;
  } else if (input.source === 'reseller_store') {
    const basePrice = pkg.resellerBasePrice;
    const customPrice = input.resellerId
      ? await getResellerPrice(input.resellerId, pkg._id, basePrice)
      : basePrice;

    sellingPrice = input.sellingPrice ?? customPrice;
    validateResellerPrice(sellingPrice, basePrice, pkg.maxSellingPrice);

    profit = computeResellerOrderProfit(sellingPrice, basePrice);
  }

  const processingFee =
    input.processingFee ??
    roundMoney(sellingPrice * ((settings.paystackChargePercent ?? 2) / 100));
  const totalAmount = roundMoney(sellingPrice + processingFee);

  const adminBasePrice = getAdminBasePrice(input.source, {
    resellerBasePrice: pkg.resellerBasePrice,
    agentPrice: pkg.agentPrice,
  });

  const { paystackFee, platformProfit } = await snapshotPlatformProfitForOrder({
    source: input.source,
    basePrice: adminBasePrice,
    apiCost,
    totalAmount,
  });

  const orderNumber = generateOrderNumber();
  const orderStatus: OrderStatus =
    input.source === 'reseller_store' && input.paystackReference ? 'processing' : 'pending';

  const orderPayload = {
    orderId: orderNumber,
    orderNumber,
    userId: input.userId,
    agentId: input.agentId,
    resellerId: input.resellerId,
    customerEmail: input.customerEmail,
    network: pkg.network,
    bundleSize: pkg.bundleSize,
    packageId: pkg._id,
    recipientPhone,
    costPrice: apiCost,
    adminBasePrice,
    sellingPrice,
    profit,
    platformProfit,
    paystackFee,
    processingFee,
    totalAmount,
    status: orderStatus,
    source: input.source,
    paystackReference: input.paystackReference,
    fulfillmentProvider: fulfillmentProvider ?? undefined,
    complaintDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  let order: InstanceType<typeof Order>;
  try {
    if (needsWalletDebit) {
      const orderRef = input.walletReference ?? generateOrderId();
      order = await withMongoTransaction(async (session) => {
        await debitWallet(
          input.agentId!,
          sellingPrice,
          'purchase',
          `Data purchase: ${pkg.network} ${pkg.bundleSize} to ${recipientPhone}`,
          orderRef,
          { packageId: pkg._id.toString() },
          session
        );

        const created = await Order.create([orderPayload], sessionOpts(session));
        const doc = created[0];
        await appendAuditLog({
          userId: input.agentId,
          action: 'purchase',
          entity: 'order',
          entityId: doc.orderId,
          details: { amount: sellingPrice, source: input.source },
        });
        return doc;
      });
    } else {
      order = await Order.create(orderPayload);
      if (input.agentId || input.resellerId) {
        await appendAuditLog({
          userId: input.agentId || input.resellerId,
          action: 'purchase',
          entity: 'order',
          entityId: order.orderId,
          details: { amount: sellingPrice, source: input.source },
        });
      }
    }
  } catch (err) {
    throw toOrderCreationError(err);
  }

  if (env.fulfillment.enabled || env.datamax.enabled) {
    await submitOrderToProvider(order);
  } else if (env.devAutoDeliver) {
  // Simulate order processing (local dev only)
    setTimeout(async () => {
      try {
        const updated = await Order.findById(order._id);
        if (updated && updated.status === 'processing') {
          await applyOrderStatusUpdate(updated, {
            status: 'delivered',
            providerStatus: 'delivered',
            stepLabel: 'Bundle Dispatched',
            stepMessage: 'Simulated delivery (dev)',
          });
        }
      } catch (err) {
        console.error('Order processing error:', err);
      }
    }, 5000);
  }

  return order;
};

export interface BulkOrderLine {
  phone: string;
  bundleSize: string;
}

export const validateBulkOrders = async (
  lines: BulkOrderLine[],
  network: string,
  agentId: string
) => {
  await assertNetworkInStock(network);

  const seenPhones = new Set<string>();
  const validated: Array<{
    phone: string;
    bundleSize: string;
    packageId: string;
    price: number;
    network: string;
  }> = [];
  let totalCost = 0;

  for (const line of lines) {
    const phone = normalizeGhanaPhone(line.phone);
    if (!isValidGhanaPhone(phone)) {
      throw new AppError(`Invalid phone number: ${line.phone}`);
    }
    if (seenPhones.has(phone)) {
      throw new AppError(`Duplicate phone number: ${phone}`);
    }
    seenPhones.add(phone);

    const bundle = line.bundleSize.toUpperCase().endsWith('GB')
      ? line.bundleSize.toUpperCase()
      : `${line.bundleSize}GB`;

    const pkg = await Package.findOne({ network: network as Network, bundleSize: bundle, isEnabled: true });
    if (!pkg) {
      throw new AppError(`Bundle ${bundle} not found for ${network}`);
    }

    validated.push({
      phone,
      bundleSize: bundle,
      packageId: pkg._id.toString(),
      price: pkg.agentPrice,
      network: pkg.network,
    });
    totalCost += pkg.agentPrice;
  }

  const wallet = await import('./walletService').then((m) => m.getOrCreateWallet(agentId));
  if (wallet.balance < totalCost) {
    throw new AppError('Insufficient wallet balance for bulk purchase');
  }

  return { validated, totalCost };
};

export const processBulkOrders = async (
  validated: Array<{ phone: string; packageId: string; price?: number }>,
  agentId: string,
  source: OrderSource = 'agent'
) => {
  const priced: Array<{ phone: string; packageId: string; price: number }> = [];
  for (const item of validated) {
    const pkg = await Package.findById(item.packageId);
    if (!pkg || !pkg.isEnabled) {
      throw new AppError(`Package not found or disabled for ${item.phone}`);
    }
    priced.push({ phone: item.phone, packageId: item.packageId, price: pkg.agentPrice });
  }

  const totalCost = roundMoney(priced.reduce((sum, item) => sum + item.price, 0));
  const bulkRef = `BULK-${generateOrderId()}`;

  if (totalCost > 0) {
    await debitWallet(
      agentId,
      totalCost,
      'purchase',
      `Bulk purchase (${priced.length} orders)`,
      bulkRef
    );
  }

  const orders = [];
  for (const item of priced) {
    const order = await createOrder({
      packageId: item.packageId,
      recipientPhone: item.phone,
      agentId,
      source,
      skipWalletDebit: true,
      walletReference: bulkRef,
    });
    orders.push(order);
  }
  return orders;
};
