import { env } from './env';

/** Primary website registered with Paystack — all payment callbacks use this origin. */
export const CANONICAL_WEBSITE = 'https://www.topdealsgh.com';

export function getCanonicalFrontendUrl(): string {
  const raw = (env.frontendUrl || CANONICAL_WEBSITE).replace(/\/$/, '');
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host === 'topdealsgh.com' || host === 'www.topdealsgh.com') {
      return CANONICAL_WEBSITE;
    }
  } catch {
    /* fall through */
  }
  return raw || CANONICAL_WEBSITE;
}
