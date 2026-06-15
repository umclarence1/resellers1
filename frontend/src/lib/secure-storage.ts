/** Persist auth in localStorage so users stay signed in across tab close (within idle timeout). */
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REFRESH_KEY = 'refreshToken';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getStoredToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function setStoredToken(token: string | null): void {
  const s = storage();
  if (!s) return;
  if (token) s.setItem(TOKEN_KEY, token);
  else s.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function setStoredRefreshToken(token: string | null): void {
  const s = storage();
  if (!s) return;
  if (token) s.setItem(REFRESH_KEY, token);
  else s.removeItem(REFRESH_KEY);
}

export function getStoredUserJson(): string | null {
  return storage()?.getItem(USER_KEY) ?? null;
}

export function setStoredUserJson(user: string | null): void {
  const s = storage();
  if (!s) return;
  if (user) s.setItem(USER_KEY, user);
  else s.removeItem(USER_KEY);
}

export function clearAuthStorage(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(REFRESH_KEY);
  s.removeItem(USER_KEY);
}

/** Migrate tokens from legacy sessionStorage into localStorage. */
export function migrateLegacyLocalStorageAuth(): void {
  if (typeof window === 'undefined') return;
  for (const key of [TOKEN_KEY, REFRESH_KEY, USER_KEY]) {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession && !localStorage.getItem(key)) {
      localStorage.setItem(key, fromSession);
    }
    sessionStorage.removeItem(key);
  }
}
