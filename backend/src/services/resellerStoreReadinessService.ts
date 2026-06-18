import { IUser } from '../models/User';
import { Package } from '../models/Package';
import { AppError } from '../middleware/errorHandler';
import { getParentAssignedPrice, hasParentReseller } from './subResellerPricingService';

export const RESELLER_STORE_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'] as const;

export function getCustomPrice(user: IUser, packageId: string): number | undefined {
  const prices = user.resellerStore?.customPrices;
  if (!prices) return undefined;
  if (prices instanceof Map) return prices.get(packageId);
  return (prices as unknown as Record<string, number>)[packageId];
}

function getAssignedPriceForNetwork(user: IUser, pkgs: Array<{ _id: { toString(): string } }>): boolean {
  return pkgs.some((pkg) => getParentAssignedPrice(user, pkg._id.toString()) !== undefined);
}

/** Parent must assign at least one floor price per network for sub-resellers. */
export async function getParentAssignedPricingStatus(user: IUser) {
  if (!hasParentReseller(user)) {
    return { parentPricesReady: true, networksMissing: [] as string[] };
  }

  const packages = await Package.find({
    isEnabled: true,
    network: { $in: RESELLER_STORE_NETWORKS },
    productType: 'data',
  }).select('_id network');

  const byNetwork = new Map<string, Array<{ _id: { toString(): string } }>>();
  for (const pkg of packages) {
    const list = byNetwork.get(pkg.network) || [];
    list.push(pkg);
    byNetwork.set(pkg.network, list);
  }

  const networksMissing: string[] = [];
  let configuredCount = 0;

  for (const [network, pkgs] of byNetwork) {
    const hasAny = getAssignedPriceForNetwork(user, pkgs);
    if (hasAny) configuredCount++;
    else networksMissing.push(network);
  }

  const requiredCount = byNetwork.size;
  const parentPricesReady = requiredCount > 0 && networksMissing.length === 0;

  return { parentPricesReady, configuredCount, requiredCount, networksMissing };
}

/** At least one explicit selling price per network with enabled packages. */
export async function getResellerPricingStatus(user: IUser) {
  const packages = await Package.find({
    isEnabled: true,
    network: { $in: RESELLER_STORE_NETWORKS },
    productType: 'data',
  }).select('_id network');

  const byNetwork = new Map<string, Array<{ _id: { toString(): string }; network: string }>>();
  for (const pkg of packages) {
    const list = byNetwork.get(pkg.network) || [];
    list.push(pkg);
    byNetwork.set(pkg.network, list);
  }

  const networksMissing: string[] = [];
  let configuredCount = 0;

  for (const [network, pkgs] of byNetwork) {
    const hasAny = pkgs.some((pkg) => getCustomPrice(user, pkg._id.toString()) !== undefined);
    if (hasAny) configuredCount++;
    else networksMissing.push(network);
  }

  const requiredCount = byNetwork.size;
  const ownPricesReady = requiredCount > 0 && networksMissing.length === 0;
  const parentStatus = await getParentAssignedPricingStatus(user);
  const pricesReady = ownPricesReady && parentStatus.parentPricesReady;

  return {
    pricesReady,
    ownPricesReady,
    configuredCount,
    requiredCount,
    networksMissing,
    parentPricesReady: parentStatus.parentPricesReady,
    parentPricesPending: !parentStatus.parentPricesReady,
    parentNetworksMissing: parentStatus.networksMissing,
  };
}

export async function assertResellerPricesReady(user: IUser) {
  const status = await getResellerPricingStatus(user);
  if (!status.pricesReady) {
    const missing =
      status.networksMissing.length > 0
        ? ` Set at least one price for: ${status.networksMissing.join(', ')}.`
        : ' No packages are available yet.';
    throw new AppError(`Set your store prices before continuing.${missing}`);
  }
  return status;
}
