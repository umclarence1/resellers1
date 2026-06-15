const STORAGE_KEY = 'reseller_store_ref';

/** Share link on the main domain — reseller earns profit on orders placed via this ref. */
export function buildResellerStoreUrl(slug: string, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return `${origin}/?r=${encodeURIComponent(slug)}`;
}

export function buildStoreHomePath(slug: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ r: slug, ...extra });
  return `/?${params.toString()}`;
}

export function buildStoreBuyPath(slug: string, network: string) {
  return `/buy/${encodeURIComponent(network)}?r=${encodeURIComponent(slug)}`;
}

export function readStoreRef(searchParams: URLSearchParams): string | null {
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
