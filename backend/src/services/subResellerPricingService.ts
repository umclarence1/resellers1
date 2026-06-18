import mongoose from 'mongoose';
import { IPackage } from '../models/Package';
import { IUser, User } from '../models/User';
import { IUplineProfit } from '../models/Order';
import { AppError } from '../middleware/errorHandler';
import { slugify, isValidStoreSlug } from '../utils/helpers';
import { getCustomPrice } from './resellerStoreReadinessService';
import { computeResellerProfit } from './resellerProfitService';

const MAX_UPLINE_DEPTH = 32;

export function getParentAssignedPrice(user: IUser, packageId: string): number | undefined {
  const prices = user.resellerStore?.parentAssignedPrices;
  if (!prices) return undefined;
  if (prices instanceof Map) return prices.get(packageId);
  return (prices as unknown as Record<string, number>)[packageId];
}

export function getEffectiveBasePrice(
  user: IUser,
  packageId: string,
  pkg: Pick<IPackage, 'resellerBasePrice'>
): number {
  const assigned = getParentAssignedPrice(user, packageId);
  return assigned ?? pkg.resellerBasePrice;
}

export function getResellerSellPrice(
  user: IUser,
  packageId: string,
  pkg: Pick<IPackage, 'resellerBasePrice'>
): number {
  const custom = getCustomPrice(user, packageId);
  const effectiveBase = getEffectiveBasePrice(user, packageId, pkg);
  return custom ?? effectiveBase;
}

export function hasParentReseller(user: IUser): boolean {
  return Boolean(user.resellerStore?.referredBy);
}

export async function generateUniqueResellerSlug(
  preferredSlug: string,
  excludeUserId?: string
): Promise<string> {
  const base = slugify(preferredSlug) || 'my-store';
  let slug = base;
  let counter = 1;
  while (
    await User.findOne({
      'resellerStore.slug': slug,
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
  ) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function getUplineChain(leafResellerId: mongoose.Types.ObjectId | string): Promise<IUser[]> {
  const chain: IUser[] = [];
  let currentId: mongoose.Types.ObjectId | undefined =
    typeof leafResellerId === 'string'
      ? new mongoose.Types.ObjectId(leafResellerId)
      : leafResellerId;

  for (let depth = 0; depth < MAX_UPLINE_DEPTH && currentId; depth++) {
    const user: IUser | null = await User.findById(currentId);
    if (!user?.resellerStore) break;
    chain.push(user);
    currentId = user.resellerStore.referredBy;
  }

  return chain;
}

export function splitProfitsFromBaseChain(
  sellingPrice: number,
  chain: Array<{ _id: mongoose.Types.ObjectId }>,
  bases: number[]
): { leafProfit: number; uplineProfits: IUplineProfit[] } {
  if (chain.length === 0 || bases.length === 0) {
    return { leafProfit: 0, uplineProfits: [] };
  }

  const leafProfit = computeResellerProfit(sellingPrice, bases[0]!);
  const uplineProfits: IUplineProfit[] = [];

  for (let i = 0; i < chain.length - 1; i++) {
    const profit = computeResellerProfit(bases[i]!, bases[i + 1]!);
    if (profit > 0) {
      uplineProfits.push({
        resellerId: chain[i + 1]!._id,
        profit,
      });
    }
  }

  return { leafProfit, uplineProfits };
}

export async function computeMultiLevelProfitSplit(
  sellingPrice: number,
  leafResellerId: mongoose.Types.ObjectId | string,
  packageId: string,
  pkg: Pick<IPackage, 'resellerBasePrice'>
): Promise<{ leafProfit: number; uplineProfits: IUplineProfit[] }> {
  const chain = await getUplineChain(leafResellerId);
  if (chain.length === 0) {
    return { leafProfit: 0, uplineProfits: [] };
  }

  const bases = chain.map((user) => getEffectiveBasePrice(user, packageId, pkg));
  return splitProfitsFromBaseChain(sellingPrice, chain, bases);
}

export async function assertDirectChild(parentId: string, childId: string): Promise<IUser> {
  const child = await User.findOne({ _id: childId, role: 'reseller' });
  if (!child?.resellerStore) throw new AppError('Sub-reseller not found', 404);
  if (child.resellerStore.referredBy?.toString() !== parentId) {
    throw new AppError('Not authorized to manage this sub-reseller', 403);
  }
  return child;
}

export async function setSubResellerAssignedPrice(
  parentId: string,
  childId: string,
  packageId: string,
  price: number,
  pkg: Pick<IPackage, 'resellerBasePrice' | 'maxSellingPrice'>
): Promise<void> {
  const [parent, child] = await Promise.all([
    User.findOne({ _id: parentId, role: 'reseller' }),
    assertDirectChild(parentId, childId),
  ]);

  if (!parent?.resellerStore) throw new AppError('Parent store not found', 404);
  if (!child.resellerStore) throw new AppError('Sub-reseller store not found', 404);

  const parentFloor = getEffectiveBasePrice(parent, packageId, pkg);
  if (price < parentFloor) {
    throw new AppError(`Price cannot be below your cost of GHS ${parentFloor}`);
  }
  if (price > pkg.maxSellingPrice) {
    throw new AppError('Price exceeds allowed limit.');
  }

  if (!child.resellerStore.parentAssignedPrices) {
    child.resellerStore.parentAssignedPrices = new Map();
  }
  child.resellerStore.parentAssignedPrices.set(packageId, price);
  child.markModified('resellerStore.parentAssignedPrices');
  await child.save();
}

export function validateStoreSlugInput(slug: string): void {
  const normalized = slugify(slug);
  if (!isValidStoreSlug(normalized)) {
    throw new AppError('Store URL slug must be 2–64 characters (letters, numbers, hyphens only)');
  }
}
