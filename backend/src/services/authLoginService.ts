import { IUser, User } from '../models/User';
import { getUserTotpSecret } from '../services/totpService';

export type LoginPortalRole = 'admin' | 'agent' | 'reseller';

export function normalizeAuthEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/** Map legacy dealer accounts to the agent login portal. */
export function accountRoleForPortal(user: { role: string }): LoginPortalRole {
  if (user.role === 'dealer') return 'agent';
  return user.role as LoginPortalRole;
}

export function matchesLoginPortal(user: { role: string }, portalRole: LoginPortalRole): boolean {
  return accountRoleForPortal(user) === portalRole;
}

export async function findUserForAuthLogin(email: string) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return null;

  let user = await User.findOne({ email: normalized }).select('+totpSecretEnc');
  if (!user) {
    user = await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(normalized)}\\s*$`, 'i') },
    }).select('+totpSecretEnc');
    if (user) {
      user.email = normalized;
      await user.save();
    }
  }

  return user;
}

export async function repairLegacyAgentAccount(user: InstanceType<typeof User>): Promise<void> {
  let dirty = false;

  if ((user.role as string) === 'dealer') {
    user.role = 'agent';
    dirty = true;
  }

  if (user.loginLockedUntil && user.loginLockedUntil <= new Date()) {
    user.loginLockedUntil = undefined;
    user.failedLoginAttempts = 0;
    dirty = true;
  }

  if (user.totpEnabled && !getUserTotpSecret(user)) {
    user.totpEnabled = false;
    user.totpSecretEnc = undefined;
    dirty = true;
  }

  if (dirty) {
    await user.save();
  }
}

export function prefersTotpLogin(user: Pick<IUser, 'totpEnabled' | 'totpSecretEnc'>): boolean {
  return user.totpEnabled === true && Boolean(getUserTotpSecret(user));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
