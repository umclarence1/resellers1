export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const LAST_ACTIVITY_KEY = 'lastActivity';

export function touchSessionActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function clearSessionActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function getSessionIdleMs(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return 0;
  const last = Number(raw);
  if (!Number.isFinite(last)) return SESSION_TIMEOUT_MS + 1;
  return Date.now() - last;
}

export function isSessionExpired(): boolean {
  return getSessionIdleMs() >= SESSION_TIMEOUT_MS;
}
