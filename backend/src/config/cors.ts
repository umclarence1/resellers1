import { env } from './env';

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

/** Exact-match CORS allowlist — prevents subdomain/prefix bypass. */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  if (env.nodeEnv === 'development') {
    return /^https?:\/\/localhost(:\d+)?$/.test(origin);
  }

  const allowed = [env.frontendUrl, env.apiUrl]
    .filter(Boolean)
    .map(normalizeOrigin);

  return allowed.includes(normalizeOrigin(origin));
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
}
