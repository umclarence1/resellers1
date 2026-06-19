import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';

function slugParam(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] ?? '' : raw;
}

/** Normalize store slug from URL params (case, whitespace, encoding). */
export function normalizeStoreSlug(raw: string | string[]): string {
  const value = slugParam(raw);
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

type FindResellerOptions = {
  requireActiveStore?: boolean;
  requireActiveAccount?: boolean;
  select?: string;
};

export async function findResellerByStoreSlug(slugParam: string | string[], options: FindResellerOptions = {}) {
  const slug = normalizeStoreSlug(slugParam);
  if (!slug) return null;

  const query: Record<string, unknown> = {
    'resellerStore.slug': slug,
    role: 'reseller',
  };
  if (options.requireActiveStore) {
    query['resellerStore.isActive'] = true;
  }
  if (options.requireActiveAccount) {
    query.status = 'active';
  }

  let q = User.findOne(query);
  if (options.select) q = q.select(options.select);
  return q;
}

export async function requireResellerStore(slugParam: string | string[], options: FindResellerOptions = {}) {
  const reseller = await findResellerByStoreSlug(slugParam, options);
  if (!reseller?.resellerStore) throw new AppError('Store not found', 404);
  return reseller;
}

export async function requireOpenResellerStore(slugParam: string | string[], select?: string) {
  const reseller = await requireResellerStore(slugParam, { select });
  const store = reseller.resellerStore!;
  if (!store.isActive || reseller.status !== 'active') {
    throw new AppError('This store is currently unavailable', 403);
  }
  return reseller;
}

export function storeSlugFromRequest(slugParam: string | string[]): string {
  return normalizeStoreSlug(slugParam);
}
