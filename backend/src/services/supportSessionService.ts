import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export type SupportSessionPayload = {
  kind: 'store_verified';
  storeSlug: string;
  identifier: string;
  identifierType: 'email' | 'phone';
};

const SUPPORT_SESSION_TTL = '15m';

export function signSupportSession(payload: SupportSessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: SUPPORT_SESSION_TTL });
}

export function verifySupportSession(token: string): SupportSessionPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as SupportSessionPayload;
    if (decoded.kind !== 'store_verified' || !decoded.storeSlug || !decoded.identifier) {
      throw new AppError('Invalid support session', 401);
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Support session expired. Please verify again.', 401);
  }
}
