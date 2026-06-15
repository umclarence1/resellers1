import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { logSecurityEvent } from '../services/securityAuditService';
import {
  incrementAdminActionOtpAttempts,
  verifyAdminActionOtp,
} from '../services/adminActionOtpService';

function extractOtp(req: AuthRequest): string | undefined {
  if (typeof req.body?.adminOtp === 'string' && req.body.adminOtp) {
    return req.body.adminOtp;
  }
  if (typeof req.query?.adminOtp === 'string' && req.query.adminOtp) {
    return req.query.adminOtp;
  }
  return undefined;
}

/** Require the authenticated admin to verify a one-time email code for sensitive operations. */
export const requireAdminOtp = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const code = extractOtp(req);
  if (!code) {
    throw new AppError('Email verification code required for this action', 403);
  }

  const userId = req.user?._id;
  if (!userId) throw new AppError('Unauthorized', 401);

  const valid = await verifyAdminActionOtp(userId, code);
  if (!valid) {
    await incrementAdminActionOtpAttempts(userId);
    await logSecurityEvent({
      userId,
      action: 'admin_reauth_failed',
      entity: 'auth',
      ip: req.ip,
      success: false,
    });
    throw new AppError('Invalid or expired verification code', 403);
  }

  next();
};

/** @deprecated Use requireAdminOtp */
export const requireAdminPassword = requireAdminOtp;
