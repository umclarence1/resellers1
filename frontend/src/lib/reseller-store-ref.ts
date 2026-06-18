import { APP_URL } from './deploy';
import { CANONICAL_WEBSITE } from './canonical-site';

const STORAGE_KEY = 'reseller_store_ref';

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const STORE_PATH_RE = /^\/store\/([^/]+)/;

/** Customer-facing store home on the canonical domain (slug from store name). */
export function buildResellerStoreUrl(slug: string) {
  const origin = (APP_URL || CANONICAL_WEBSITE).replace(/\/$/, '');
  return `${origin}/store/${encodeURIComponent(slug)}`;
}

export function buildStoreHomePath(slug: string, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);
  const query = params.toString();
  const base = `/store/${encodeURIComponent(slug)}`;
  return query ? `${base}?${query}` : base;
}

export function buildStoreAfaPath(slug: string) {
  return `/store/${encodeURIComponent(slug)}/afa`;
}

export function buildStoreCheckerPath(slug: string) {
  return `/store/${encodeURIComponent(slug)}/checker`;
}

export function buildStoreBecomeResellerPath(slug: string) {
  return `/store/${encodeURIComponent(slug)}/become-reseller`;
}

export function buildStoreCheckerSuccessPath(slug: string, orderId: string, email?: string) {
  const params = new URLSearchParams({ orderId });
  if (email) params.set('email', email);
  return `/store/${encodeURIComponent(slug)}/checker/success?${params.toString()}`;
}

export function buildStoreBuyPath(slug: string, network: string) {
  return `/store/${encodeURIComponent(slug)}/buy/${encodeURIComponent(network)}`;
}

export function readStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(STORE_PATH_RE);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

/** Legacy ?r= query param — prefer /store/:slug paths for new links. */
export function readStoreRef(searchParams: URLSearchParams, pathname = ''): string | null {
  const fromPath = readStoreSlugFromPath(pathname);
  if (fromPath) {
    persistStoreRef(fromPath);
    return fromPath;
  }

  const fromQuery = searchParams.get('r')?.trim();
  if (fromQuery) {
    persistStoreRef(fromQuery);
    return fromQuery;
  }
  return readPersistedStoreRef();
}

export function persistStoreRef(slug: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function readPersistedStoreRef(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}
