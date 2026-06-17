import { env } from './env';
import { PLATFORM_NAME } from './brand';

/** Single canonical website for Paystack callbacks, store links, and compliance. */
export const CANONICAL_WEBSITE = 'https://www.topdealsgh.com';

export function getCanonicalFrontendUrl(): string {
  const raw = (env.frontendUrl || CANONICAL_WEBSITE).replace(/\/$/, '');
  try {
    const url = new URL(raw);
    if (url.hostname === 'topdealsgh.com' || url.hostname === 'www.topdealsgh.com') {
      return CANONICAL_WEBSITE;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return CANONICAL_WEBSITE;
  }
}

export function buildStoreShareUrl(slug: string): string {
  return `${getCanonicalFrontendUrl()}/store/${encodeURIComponent(slug)}`;
}

export function paystackPlatformMetadata(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...extra,
    platform: PLATFORM_NAME,
    website: getCanonicalFrontendUrl(),
  };
}
