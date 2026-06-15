import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, IUser, UserRole } from '../models/User';
import { AppError, asyncHandler } from './errorHandler';

export interface AuthRequest extends Request {
  user?: IUser;
  tokenPayload?: JwtPayload;
}

export const authenticate = asyncHandler(async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  const user = await User.findById(payload.userId);
  if (!user || user.status === 'suspended') {
    throw new AppError('Account not found or suspended', 401);
  }

  if (user.role !== payload.role) {
    throw new AppError('Authentication required', 401);
  }

  const currentVersion = user.tokenVersion ?? 0;
  if ((payload.tokenVersion ?? 0) !== currentVersion) {
    throw new AppError('Session expired. Please log in again.', 401);
  }

  req.user = user;
  req.tokenPayload = payload;
  next();
});

/** Attach user when Bearer token is valid; otherwise continue anonymously. */
export const optionalAuthenticate = asyncHandler(async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);
    if (user && user.status !== 'suspended' && user.role === payload.role) {
      const currentVersion = user.tokenVersion ?? 0;
      if ((payload.tokenVersion ?? 0) === currentVersion) {
        req.user = user;
        req.tokenPayload = payload;
      }
    }
  } catch {
    // anonymous support chat
  }
  next();
});

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('Access denied', 403);
    }
    next();
  };
};
