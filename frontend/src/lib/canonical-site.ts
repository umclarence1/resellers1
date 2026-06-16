import { APP_URL } from './deploy';

export const CANONICAL_WEBSITE = 'https://www.topdealsgh.com';

const CANONICAL_HOSTS = new Set(['www.topdealsgh.com', 'topdealsgh.com']);

/** Redirect legacy/alternate hosts (e.g. resellers1.vercel.app) to the Paystack-registered website. */
export function redirectToCanonicalSite(): void {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;

  const current = window.location;
  if (current.hostname === 'localhost' || current.hostname === '127.0.0.1') return;

  const canonicalOrigin = (APP_URL || CANONICAL_WEBSITE).replace(/\/$/, '');
  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOrigin).hostname;
  } catch {
    canonicalHost = 'www.topdealsgh.com';
  }

  const onCanonicalHost =
    current.hostname === canonicalHost ||
    (CANONICAL_HOSTS.has(current.hostname) && CANONICAL_HOSTS.has(canonicalHost));

  const needsRedirect =
    !onCanonicalHost || current.protocol !== 'https:' || current.hostname === 'topdealsgh.com';

  if (!needsRedirect) return;

  const targetHost = canonicalHost === 'topdealsgh.com' ? 'www.topdealsgh.com' : canonicalHost;
  const target = `https://${targetHost}${current.pathname}${current.search}${current.hash}`;
  window.location.replace(target);
}
