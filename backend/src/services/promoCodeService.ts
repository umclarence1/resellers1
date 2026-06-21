import crypto from 'crypto';
import mongoose from 'mongoose';
import { PromoCode, IPromoCode, PromoCodeStatus } from '../models/PromoCode';
import { Package } from '../models/Package';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '../utils/helpers';
import { env } from '../config/env';
import { appendAuditLog } from './immutableAuditService';

export const PROMO_INVALID_MESSAGE = 'Invalid or expired promo code';
export const MAX_PROMO_BATCH_SIZE = 500;
export const MIN_CHECKOUT_TOTAL_GHS = 0.5;
export const MAX_PROMO_DISCOUNT_GHS = 500;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function promoPepper(): string {
  return env.encryptionKey || env.jwtSecret || 'dev-promo-pepper';
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashPromoCode(normalizedCode: string): string {
  return crypto
    .createHash('sha256')
    .update(`${promoPepper()}:${normalizedCode}`)
    .digest('hex');
}

function generateSingleCode(): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return `TD-${suffix}`;
}

export interface CheckoutTotals {
  originalSellingPrice: number;
  discountedSellingPrice: number;
  discountGhs: number;
  processingFee: number;
  total: number;
}

export function computeStoreCheckoutTotals(
  sellingPrice: number,
  paystackChargePercent: number,
  discountGhs?: number
): CheckoutTotals {
  const originalSellingPrice = roundMoney(sellingPrice);
  const appliedDiscount = discountGhs ? roundMoney(Math.min(discountGhs, originalSellingPrice)) : 0;
  const discountedSellingPrice = roundMoney(Math.max(0, originalSellingPrice - appliedDiscount));
  const processingFee = roundMoney(discountedSellingPrice * (paystackChargePercent / 100));
  const total = roundMoney(discountedSellingPrice + processingFee);

  return {
    originalSellingPrice,
    discountedSellingPrice,
    discountGhs: appliedDiscount,
    processingFee,
    total,
  };
}

function assertMinimumCheckoutTotal(total: number): void {
  if (total < MIN_CHECKOUT_TOTAL_GHS) {
    throw new AppError(
      `Promo discount is too large. Minimum checkout total is GHS ${MIN_CHECKOUT_TOTAL_GHS}`,
      400
    );
  }
}

function isExpired(doc: Pick<IPromoCode, 'expiresAt'>): boolean {
  return !!doc.expiresAt && doc.expiresAt.getTime() < Date.now();
}

async function findActivePromoByCode(normalizedCode: string): Promise<IPromoCode | null> {
  const codeHash = hashPromoCode(normalizedCode);
  const doc = await PromoCode.findOne({ codeHash });
  if (!doc) return null;
  if (doc.status !== 'active') return null;
  if (isExpired(doc)) return null;
  return doc;
}

export async function validatePromoForCheckout(input: {
  code: string;
  packageId: string;
  sellingPrice: number;
  paystackChargePercent: number;
}) {
  const normalized = normalizePromoCode(input.code);
  if (normalized.length < 6) {
    throw new AppError(PROMO_INVALID_MESSAGE, 400);
  }

  const doc = await findActivePromoByCode(normalized);
  if (!doc) {
    throw new AppError(PROMO_INVALID_MESSAGE, 400);
  }

  const totals = computeStoreCheckoutTotals(
    input.sellingPrice,
    input.paystackChargePercent,
    doc.discountGhs
  );
  assertMinimumCheckoutTotal(totals.total);

  return {
    promoCodeId: doc._id.toString(),
    ...totals,
  };
}

export async function redeemPromoCode(input: {
  promoCodeId: string;
  paystackReference: string;
  orderId: string;
  email?: string;
}) {
  const redeemed = await PromoCode.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(input.promoCodeId),
      status: 'active',
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    },
    {
      $set: {
        status: 'used' as PromoCodeStatus,
        usedAt: new Date(),
        usedByEmail: input.email?.trim().toLowerCase(),
        orderId: input.orderId,
        paystackReference: input.paystackReference,
      },
    },
    { new: true }
  );

  if (!redeemed) {
    await appendAuditLog({
      action: 'promo_redeem_failed',
      entity: 'promo_code',
      entityId: input.promoCodeId,
      details: {
        paystackReference: input.paystackReference,
        orderId: input.orderId,
      },
    });
    throw new Error('Promo code could not be redeemed');
  }

  await appendAuditLog({
    action: 'promo_redeemed',
    entity: 'promo_code',
    entityId: redeemed._id.toString(),
    details: {
      batchId: redeemed.batchId,
      orderId: input.orderId,
      paystackReference: input.paystackReference,
    },
  });

  return redeemed;
}

export async function generatePromoCodes(input: {
  discountGhs: number;
  count: number;
  expiresAt?: Date;
  label?: string;
  adminId: string;
}) {
  const count = Math.floor(input.count);
  if (!Number.isFinite(count) || count < 1 || count > MAX_PROMO_BATCH_SIZE) {
    throw new AppError(`Count must be between 1 and ${MAX_PROMO_BATCH_SIZE}`, 400);
  }

  const discountGhs = roundMoney(input.discountGhs);
  if (!Number.isFinite(discountGhs) || discountGhs <= 0) {
    throw new AppError('Discount must be greater than zero', 400);
  }

  if (discountGhs > MAX_PROMO_DISCOUNT_GHS) {
    throw new AppError(`Discount cannot exceed GHS ${MAX_PROMO_DISCOUNT_GHS}`, 400);
  }

  const batchId = `batch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const plaintextCodes: string[] = [];
  const docs: Array<Record<string, unknown>> = [];
  const seenHashes = new Set<string>();

  while (plaintextCodes.length < count) {
    const code = generateSingleCode();
    const normalized = normalizePromoCode(code);
    const codeHash = hashPromoCode(normalized);
    if (seenHashes.has(codeHash)) continue;

    seenHashes.add(codeHash);
    plaintextCodes.push(code);
    docs.push({
      codeHash,
      codeLast4: normalized.slice(-4),
      discountGhs,
      batchId,
      label: input.label?.trim() || undefined,
      status: 'active',
      expiresAt: input.expiresAt,
      createdBy: new mongoose.Types.ObjectId(input.adminId),
    });
  }

  await PromoCode.insertMany(docs);

  await appendAuditLog({
    userId: input.adminId,
    action: 'promo_batch_create',
    entity: 'promo_code_batch',
    entityId: batchId,
    details: {
      scope: 'all_products',
      discountGhs,
      count,
      label: input.label?.trim() || null,
      expiresAt: input.expiresAt?.toISOString() || null,
    },
  });

  return {
    batchId,
    scope: 'all_products' as const,
    discountGhs,
    count,
    codes: plaintextCodes,
  };
}

export async function listPromoCodes(filters: {
  page?: number;
  limit?: number;
  packageId?: string;
  status?: PromoCodeStatus;
  batchId?: string;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const query: Record<string, unknown> = {};

  if (filters.packageId) query.packageId = filters.packageId;
  if (filters.status) query.status = filters.status;
  if (filters.batchId) query.batchId = filters.batchId;

  const [items, total] = await Promise.all([
    PromoCode.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('packageId', 'network bundleSize productType')
      .lean(),
    PromoCode.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

export async function listPromoBatches() {
  const rows = await PromoCode.aggregate([
    {
      $group: {
        _id: '$batchId',
        label: { $first: '$label' },
        packageId: { $first: '$packageId' },
        discountGhs: { $first: '$discountGhs' },
        createdAt: { $first: '$createdAt' },
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        used: {
          $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] },
        },
        disabled: {
          $sum: { $cond: [{ $eq: ['$status', 'disabled'] }, 1, 0] },
        },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 100 },
  ]);

  const packageIds = rows.map((r) => r.packageId).filter(Boolean);
  const packages = await Package.find({ _id: { $in: packageIds } })
    .select('network bundleSize productType')
    .lean();
  const pkgMap = new Map(packages.map((p) => [p._id.toString(), p]));

  return rows.map((row) => ({
    batchId: row._id,
    label: row.label,
    packageId: row.packageId?.toString() || null,
    package: row.packageId ? pkgMap.get(row.packageId?.toString() || '') || null : null,
    scope: row.packageId ? 'legacy_package' : 'all_products',
    discountGhs: row.discountGhs,
    createdAt: row.createdAt,
    total: row.total,
    active: row.active,
    used: row.used,
    disabled: row.disabled,
  }));
}

export async function disablePromoCode(id: string, adminId: string) {
  const updated = await PromoCode.findOneAndUpdate(
    { _id: id, status: 'active' },
    { $set: { status: 'disabled' } },
    { new: true }
  );
  if (!updated) throw new AppError('Promo code not found or already used/disabled', 404);

  await appendAuditLog({
    userId: adminId,
    action: 'promo_disabled',
    entity: 'promo_code',
    entityId: id,
    details: { batchId: updated.batchId },
  });

  return updated;
}

export async function disablePromoBatch(batchId: string, adminId: string) {
  const result = await PromoCode.updateMany(
    { batchId, status: 'active' },
    { $set: { status: 'disabled' } }
  );

  if (result.modifiedCount === 0) {
    throw new AppError('No active codes found in this batch', 404);
  }

  await appendAuditLog({
    userId: adminId,
    action: 'promo_batch_disabled',
    entity: 'promo_code_batch',
    entityId: batchId,
    details: { disabledCount: result.modifiedCount },
  });

  return { disabledCount: result.modifiedCount };
}
