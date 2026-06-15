import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { AppError } from '../middleware/errorHandler';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

export const signAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
};

/** @deprecated Use signAccessToken */
export const signToken = signAccessToken;

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Session expired. Please log in again.', 401);
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid or expired token', 401);
    }
    throw err;
  }
};
