import mongoose from 'mongoose';
import { IPackage } from '../models/Package';
import { IUser, User } from '../models/User';
import { IUplineProfit } from '../models/Order';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, slugify, isValidStoreSlug } from '../utils/helpers';
import { getCustomPrice } from './resellerStoreReadinessService';
import { computeResellerProfit } from './resellerProfitService';

/** Admin markup passed down the entire reseller chain (max sell − API cost). */
export function computeInheritedMaxMarkup(
  pkg: Pick<IPackage, 'costPrice' | 'maxSellingPrice'>
): number {
  return roundMoney(Math.max(0, pkg.maxSellingPrice - pkg.costPrice));
}

/** Sub-reseller max = assigned base + inherited markup (same spread admin gave the parent). */
export function computeSubResellerMaxFromFloor(
  floor: number,
  pkg: Pick<IPackage, 'costPrice' | 'maxSellingPrice'>
): number {
  return roundMoney(floor + computeInheritedMaxMarkup(pkg));
}

const MAX_UPLINE_DEPTH = 32;

function readMapValue(map: Map<string, number> | undefined, key: string): number | undefined {
  if (!map) return undefined;
  if (map instanceof Map) return map.get(key);
  return (map as unknown as Record<string, number>)[key];
}

function ensureMap(store: NonNullable<IUser['resellerStore']>, field: keyof Pick<
  NonNullable<IUser['resellerStore']>,
  'parentAssignedPrices' | 'parentAssignedMaxPrices' | 'subResellerDefaultFloors' | 'subResellerDefaultMaxes'
>): Map<string, number> {
  const current = store[field];
  if (current instanceof Map) return current;
  const next = new Map<string, number>();
  store[field] = next;
  return next;
}

export function getParentAssignedPrice(user: IUser, packageId: string): number | undefined {
  return readMapValue(user.resellerStore?.parentAssignedPrices, packageId);
}

export function getParentAssignedMaxPrice(user: IUser, packageId: string): number | undefined {
  return readMapValue(user.resellerStore?.parentAssignedMaxPrices, packageId);
}

export function getSubResellerDefaultFloor(user: IUser, packageId: string): number | undefined {
  return readMapValue(user.resellerStore?.subResellerDefaultFloors, packageId);
}

export function getSubResellerDefaultMax(user: IUser, packageId: string): number | undefined {
  return readMapValue(user.resellerStore?.subResellerDefaultMaxes, packageId);
}

export function getEffectiveBasePrice(
  user: IUser,
  packageId: string,
  pkg: Pick<IPackage, 'resellerBasePrice'>
): number {
  const assigned = getParentAssignedPrice(user, packageId);
  return assigned ?? pkg.resellerBasePrice;
}

/**
 * Cascading max:
 * - sub-reseller with parent floor → floor + inherited admin markup
 * - otherwise → admin package max (never the reseller's own sell price)
 */
export function getEffectiveMaxPrice(
  user: IUser,
  packageId: string,
  pkg: Pick<IPackage, 'costPrice' | 'maxSellingPrice'>
): number {
  const assignedFloor = getParentAssignedPrice(user, packageId);
  if (assignedFloor !== undefined) {
    return computeSubResellerMaxFromFloor(assignedFloor, pkg);
  }

  return pkg.maxSellingPrice;
}

export function getParentAssignableRange(
  parent: IUser,
  packageId: string,
  pkg: Pick<IPackage, 'resellerBasePrice' | 'costPrice' | 'maxSellingPrice'>
): { parentCost: number; maxCeiling: number; inheritedMarkup: number } {
  const parentCost = getEffectiveBasePrice(parent, packageId, pkg);
  const maxCeiling = getEffectiveMaxPrice(parent, packageId, pkg);
  return {
    parentCost,
    maxCeiling,
    inheritedMarkup: computeInheritedMaxMarkup(pkg),
  };
}

export function validateSubResellerFloor(
  floor: number,
  parentCost: number,
  maxCeiling: number
): void {
  if (floor < parentCost) {
    throw new AppError(`Base price cannot be below your cost of GHS ${parentCost}`);
  }
  if (floor > maxCeiling) {
    throw new AppError(`Base price cannot exceed your maximum selling price of GHS ${maxCeiling}`);
  }
}

/** @deprecated Sub-reseller max is derived from floor + inherited markup */
export function validateFloorMaxRange(
  floor: number,
  max: number,
  parentCost: number,
  maxCeiling: number
): void {
  validateSubResellerFloor(floor, parentCost, maxCeiling);
  if (max < floor) {
    throw new AppError('Max price cannot be below floor price');
  }
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
    throw new AppError('Not authorized to manage this sub-reseller', 404);
  }
  return child;
}

export async function setSubResellerDefaultPricing(
  parentId: string,
  packageId: string,
  floor: number,
  pkg: Pick<IPackage, 'resellerBasePrice' | 'costPrice' | 'maxSellingPrice'>
): Promise<number> {
  const parent = await User.findOne({ _id: parentId, role: 'reseller' });
  if (!parent?.resellerStore) throw new AppError('Store not found', 404);

  const { parentCost, maxCeiling } = getParentAssignableRange(parent, packageId, pkg);
  validateSubResellerFloor(floor, parentCost, maxCeiling);
  const max = computeSubResellerMaxFromFloor(floor, pkg);

  const floors = ensureMap(parent.resellerStore, 'subResellerDefaultFloors');
  const maxes = ensureMap(parent.resellerStore, 'subResellerDefaultMaxes');
  floors.set(packageId, floor);
  maxes.set(packageId, max);
  parent.markModified('resellerStore.subResellerDefaultFloors');
  parent.markModified('resellerStore.subResellerDefaultMaxes');
  await parent.save();
  return max;
}

export async function setSubResellerAssignedPricing(
  parentId: string,
  childId: string,
  packageId: string,
  floor: number,
  pkg: Pick<IPackage, 'resellerBasePrice' | 'costPrice' | 'maxSellingPrice'>
): Promise<number> {
  const [parent, child] = await Promise.all([
    User.findOne({ _id: parentId, role: 'reseller' }),
    assertDirectChild(parentId, childId),
  ]);

  if (!parent?.resellerStore) throw new AppError('Parent store not found', 404);
  if (!child.resellerStore) throw new AppError('Sub-reseller store not found', 404);

  const { parentCost, maxCeiling } = getParentAssignableRange(parent, packageId, pkg);
  validateSubResellerFloor(floor, parentCost, maxCeiling);
  const max = computeSubResellerMaxFromFloor(floor, pkg);

  const floors = ensureMap(child.resellerStore, 'parentAssignedPrices');
  const maxes = ensureMap(child.resellerStore, 'parentAssignedMaxPrices');
  floors.set(packageId, floor);
  maxes.set(packageId, max);
  child.markModified('resellerStore.parentAssignedPrices');
  child.markModified('resellerStore.parentAssignedMaxPrices');
  await child.save();
  return max;
}

/** @deprecated Use setSubResellerAssignedPricing with floor + max */
export async function setSubResellerAssignedPrice(
  parentId: string,
  childId: string,
  packageId: string,
  price: number,
  pkg: Pick<IPackage, 'resellerBasePrice' | 'costPrice' | 'maxSellingPrice'>
): Promise<void> {
  await setSubResellerAssignedPricing(parentId, childId, packageId, price, pkg);
}

export function copySubResellerTemplateToChild(parent: IUser, child: IUser): void {
  if (!parent.resellerStore || !child.resellerStore) return;

  const templateFloors = parent.resellerStore.subResellerDefaultFloors;
  const templateMaxes = parent.resellerStore.subResellerDefaultMaxes;

  const floors = ensureMap(child.resellerStore, 'parentAssignedPrices');
  const maxes = ensureMap(child.resellerStore, 'parentAssignedMaxPrices');

  const applyFloor = (id: string, floorValue: number) => {
    floors.set(id, floorValue);
  };

  if (templateFloors instanceof Map) {
    for (const [id, value] of templateFloors) applyFloor(id, value);
  } else if (templateFloors) {
    for (const [id, value] of Object.entries(templateFloors as unknown as Record<string, number>)) {
      applyFloor(id, value);
    }
  }

  // Max prices are derived from floor + inherited markup at read time; copy cached values when present.
  if (templateMaxes instanceof Map) {
    for (const [id, value] of templateMaxes) maxes.set(id, value);
  } else if (templateMaxes) {
    for (const [id, value] of Object.entries(templateMaxes as unknown as Record<string, number>)) {
      maxes.set(id, value);
    }
  }
}

export function validateStoreSlugInput(slug: string): void {
  const normalized = slugify(slug);
  if (!isValidStoreSlug(normalized)) {
    throw new AppError('Store URL slug must be 2–64 characters (letters, numbers, hyphens only)');
  }
}
