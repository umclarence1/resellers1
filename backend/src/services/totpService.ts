import speakeasy from 'speakeasy';
import { IUser } from '../models/User';
import { encryptSecret, decryptSecret } from '../utils/encryption';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export const MFA_REQUIRED_ROLES = new Set(['admin', 'agent']);

export function roleRequiresMfa(role: string): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}

export function generateTotpSecret(): string {
  return speakeasy.generateSecret({ length: 20 }).base32;
}

export function getTotpUri(email: string, secret: string): string {
  return speakeasy.otpauthURL({
    secret,
    label: email,
    issuer: env.platformName,
    encoding: 'base32',
  });
}

export function verifyTotpCode(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: token.replace(/\s/g, ''),
    window: 1,
  });
}

export function getUserTotpSecret(user: Pick<IUser, 'totpSecretEnc'>): string | null {
  if (!user.totpSecretEnc) return null;
  try {
    return decryptSecret(user.totpSecretEnc);
  } catch {
    return null;
  }
}

export async function enableTotpForUser(user: IUser, secret: string): Promise<void> {
  user.totpSecretEnc = encryptSecret(secret);
  user.totpEnabled = true;
  await user.save();
}

export async function disableTotpForUser(user: IUser): Promise<void> {
  user.totpSecretEnc = undefined;
  user.totpEnabled = false;
  await user.save();
}

export function assertTotpCode(user: IUser, code: string): void {
  if (!user.totpEnabled) {
    throw new AppError('TOTP is not enabled for this account', 400);
  }
  const secret = getUserTotpSecret(user);
  if (!secret || !verifyTotpCode(secret, code)) {
    throw new AppError('Invalid authenticator code', 401);
  }
}
