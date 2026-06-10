/** Redirect browser to Paystack hosted checkout */
export function redirectToPaystack(authorizationUrl: string) {
  if (!authorizationUrl) {
    throw new Error('Payment URL missing from server');
  }
  window.location.href = authorizationUrl;
}
