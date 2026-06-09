import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, IUser, UserRole } from '../models/User';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: IUser;
  tokenPayload?: JwtPayload;
}

export const authenticate = async (
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

  req.user = user;
  req.tokenPayload = payload;
  next();
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('Access denied', 403);
    }
    next();
  };
};
