import { api } from './api';
import { normalizeStoreSlug } from './reseller-store-ref';

export function isRetryableStoreError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('cannot reach server') ||
    lower.includes('timeout') ||
    lower.includes('network error') ||
    lower.includes('try again')
  );
}

export async function fetchStore<T>(slug: string, retries = 2): Promise<T> {
  const normalized = normalizeStoreSlug(slug);
  if (!normalized) throw new Error('Invalid store link');

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await api.get(`/store/${encodeURIComponent(normalized)}`);
      return res.data.data as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries && isRetryableStoreError(lastErr.message)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr ?? new Error('Failed to load store');
}
