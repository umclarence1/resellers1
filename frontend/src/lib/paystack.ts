const PAYSTACK_HOSTS = new Set([
  'checkout.paystack.com',
  'paystack.com',
  'standard.paystack.com',
]);

function assertPaystackUrl(authorizationUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(authorizationUrl);
  } catch {
    throw new Error('Invalid payment URL from server');
  }
  if (parsed.protocol !== 'https:' || !PAYSTACK_HOSTS.has(parsed.hostname)) {
    throw new Error('Untrusted payment redirect blocked');
  }
}

/** Redirect browser to Paystack hosted checkout (allowlisted hosts only). */
export function redirectToPaystack(authorizationUrl: string) {
  if (!authorizationUrl) {
    throw new Error('Payment URL missing from server');
  }
  assertPaystackUrl(authorizationUrl);
  window.location.href = authorizationUrl;
}
