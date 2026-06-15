/** Production deployment URLs — overridden by VITE_* env at build time. */
export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const APP_URL =
  import.meta.env.VITE_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export function getApiHostname(): string {
  if (API_URL.startsWith('http://') || API_URL.startsWith('https://')) {
    try {
      return new URL(API_URL).hostname;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') return window.location.hostname;
  return 'resellers1-api.vercel.app';
}
