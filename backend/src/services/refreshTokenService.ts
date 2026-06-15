import crypto from 'crypto';
import mongoose from 'mongoose';
import { RefreshToken } from '../models/RefreshToken';
import { IUser, User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { signAccessToken, JwtPayload } from '../utils/jwt';
import { env } from '../config/env';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHmac('sha256', env.refreshTokenSecret).update(token).digest('hex');
}

export async function createRefreshToken(userId: mongoose.Types.ObjectId | string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return raw;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await RefreshToken.updateOne({ tokenHash }, { $set: { revoked: true } });
}

export async function revokeAllUserRefreshTokens(userId: mongoose.Types.ObjectId | string): Promise<void> {
  await RefreshToken.updateMany({ userId, revoked: false }, { $set: { revoked: true } });
}

export async function rotateRefreshToken(raw: string): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(raw);
  const stored = await RefreshToken.findOne({ tokenHash, revoked: false });
  if (!stored || stored.expiresAt < new Date()) {
    const reused = await RefreshToken.findOne({ tokenHash, revoked: true });
    if (reused) {
      await revokeAllUserRefreshTokens(reused.userId);
      throw new AppError('Session invalidated for security. Please sign in again.', 401);
    }
    throw new AppError('Invalid or expired session', 401);
  }

  const user = await User.findById(stored.userId);
  if (!user || user.status === 'suspended') {
    throw new AppError('Account not found or suspended', 401);
  }

  stored.revoked = true;
  await stored.save();

  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshToken(user._id);

  return { accessToken, refreshToken };
}

export async function invalidateUserSessions(user: IUser): Promise<void> {
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await revokeAllUserRefreshTokens(user._id);
}

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TTL_MS,
  path: '/api/auth',
};
