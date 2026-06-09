import mongoose from 'mongoose';
import { Package, Network } from '../models/Package';
import { Order, OrderSource } from '../models/Order';
import { Setting } from '../models/Setting';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { generateOrderId, isValidGhanaPhone, roundMoney } from '../utils/helpers';
import { debitWallet, creditWallet } from './walletService';
import { createNotification } from './notificationService';
import { notifyDealerWebhook } from './dealerWebhookService';
import { env } from '../config/env';

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
  dealerId?: string;
  resellerId?: string;
  customerEmail?: string;
  sellingPrice?: number;
  source: OrderSource;
  paystackReference?: string;
  processingFee?: number;
}

export const fulfillStorePurchase = async (
  reference: string,
  metadata: Record<string, unknown>,
  customerEmail?: string
) => {
  const existing = await Order.findOne({ paystackReference: reference });
  if (existing) return existing;

  const order = await createOrder({
    packageId: String(metadata.packageId),
    recipientPhone: String(metadata.recipientPhone),
    resellerId: String(metadata.resellerId),
    customerEmail: (metadata.customerEmail as string) || customerEmail,
    sellingPrice: Number(metadata.sellingPrice),
    processingFee: Number(metadata.processingFee),
    source: 'reseller_store',
    paystackReference: reference,
  });
  order.status = 'processing';
  await order.save();
  return order;
};

export const createOrder = async (input: CreateOrderInput) => {
  const pkg = await Package.findById(input.packageId);
  if (!pkg || !pkg.isEnabled) {
    throw new AppError('Package not found or disabled');
  }

  if (!isValidGhanaPhone(input.recipientPhone)) {
    throw new AppError('Recipient number must be 10 digits starting with 0');
  }

  const settings = await getSettings();
  let sellingPrice = input.sellingPrice ?? pkg.dealerPrice;
  let costPrice = pkg.costPrice;
  let profit = 0;

  if (input.source === 'dealer' || input.source === 'dealer_api') {
    sellingPrice = pkg.dealerPrice;
    costPrice = pkg.costPrice;

    if (input.dealerId) {
      await debitWallet(
        input.dealerId,
        sellingPrice,
        'purchase',
        `Data purchase: ${pkg.network} ${pkg.bundleSize} to ${input.recipientPhone}`,
        generateOrderId()
      );
    }
  } else if (input.source === 'reseller_store') {
    const basePrice = pkg.resellerBasePrice;
    const customPrice = input.resellerId
      ? await getResellerPrice(input.resellerId, pkg._id, basePrice)
      : basePrice;

    sellingPrice = input.sellingPrice ?? customPrice;
    validateResellerPrice(sellingPrice, basePrice, pkg.maxSellingPrice);

    costPrice = pkg.resellerBasePrice;
    profit = roundMoney(sellingPrice - costPrice);
  }

  const processingFee =
    input.processingFee ??
    roundMoney(sellingPrice * (settings.processingFeePercent / 100));
  const totalAmount = roundMoney(sellingPrice + processingFee);

  const order = await Order.create({
    orderId: generateOrderId(),
    userId: input.userId,
    dealerId: input.dealerId,
    resellerId: input.resellerId,
    customerEmail: input.customerEmail,
    network: pkg.network,
    bundleSize: pkg.bundleSize,
    packageId: pkg._id,
    recipientPhone: input.recipientPhone,
    costPrice,
    sellingPrice,
    profit,
    processingFee,
    totalAmount,
    status: input.source === 'reseller_store' && input.paystackReference ? 'processing' : 'pending',
    source: input.source,
    paystackReference: input.paystackReference,
    complaintDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  if (input.resellerId && profit > 0) {
    await creditWallet(
      input.resellerId,
      profit,
      'profit_credit',
      `Profit from order ${order.orderId}`,
      order.orderId
    );
  }

  // Simulate order processing (in production, integrate with telco API)
  if (env.devAutoDeliver) {
    setTimeout(async () => {
      try {
        const updated = await Order.findById(order._id);
        if (updated && updated.status === 'processing') {
          updated.status = 'delivered';
          await updated.save();

          if (updated.resellerId) {
            await createNotification(
              updated.resellerId,
              'order_delivered',
              'Order Delivered',
              `Order ${updated.orderId} has been delivered successfully.`
            );
          }
          if (updated.dealerId) {
            await createNotification(
              updated.dealerId,
              'order_delivered',
              'Order Delivered',
              `Order ${updated.orderId} has been delivered successfully.`
            );
          }
          await notifyDealerWebhook(updated);
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
  dealerId: string
) => {
  const phones = new Set<string>();
  const validated: Array<{
    phone: string;
    bundleSize: string;
    packageId: string;
    price: number;
    network: string;
  }> = [];
  let totalCost = 0;

  for (const line of lines) {
    if (!isValidGhanaPhone(line.phone)) {
      throw new AppError(`Invalid phone number: ${line.phone}`);
    }
    if (phones.has(line.phone)) {
      throw new AppError(`Duplicate phone number: ${line.phone}`);
    }
    phones.add(line.phone);

    const bundle = line.bundleSize.toUpperCase().endsWith('GB')
      ? line.bundleSize.toUpperCase()
      : `${line.bundleSize}GB`;

    const pkg = await Package.findOne({ network: network as Network, bundleSize: bundle, isEnabled: true });
    if (!pkg) {
      throw new AppError(`Bundle ${bundle} not found for ${network}`);
    }

    validated.push({
      phone: line.phone,
      bundleSize: bundle,
      packageId: pkg._id.toString(),
      price: pkg.dealerPrice,
      network: pkg.network,
    });
    totalCost += pkg.dealerPrice;
  }

  const wallet = await import('./walletService').then((m) => m.getOrCreateWallet(dealerId));
  if (wallet.balance < totalCost) {
    throw new AppError('Insufficient wallet balance for bulk purchase');
  }

  return { validated, totalCost };
};

export const processBulkOrders = async (
  validated: Array<{ phone: string; packageId: string }>,
  dealerId: string,
  source: OrderSource = 'dealer'
) => {
  const orders = [];
  for (const item of validated) {
    const order = await createOrder({
      packageId: item.packageId,
      recipientPhone: item.phone,
      dealerId,
      source,
    });
    orders.push(order);
  }
  return orders;
};
