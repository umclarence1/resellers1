import { IUser } from '../models/User';
import { Package } from '../models/Package';
import { AppError } from '../middleware/errorHandler';

export const RESELLER_STORE_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'] as const;

export function getCustomPrice(user: IUser, packageId: string): number | undefined {
  const prices = user.resellerStore?.customPrices;
  if (!prices) return undefined;
  if (prices instanceof Map) return prices.get(packageId);
  return (prices as unknown as Record<string, number>)[packageId];
}

/** At least one explicit selling price per network with enabled packages. */
export async function getResellerPricingStatus(user: IUser) {
  const packages = await Package.find({
    isEnabled: true,
    network: { $in: RESELLER_STORE_NETWORKS },
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
  const pricesReady = requiredCount > 0 && networksMissing.length === 0;

  return { pricesReady, configuredCount, requiredCount, networksMissing };
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
