import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { ApiLog } from '../models/ApiLog';
import { AppError } from './errorHandler';
import { AuthRequest } from './auth';

export interface DealerApiRequest extends AuthRequest {
  dealerId?: string;
  apiStartTime?: number;
}

export const dealerApiAuth = async (
  req: DealerApiRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  req.apiStartTime = Date.now();

  const apiKey = req.headers['x-api-key'] as string;
  const secretKey = req.headers['x-secret-key'] as string;

  if (!apiKey || !secretKey) {
    throw new AppError('API key and secret key required', 401);
  }

  const dealer = await User.findOne({
    role: 'dealer',
    'dealerApi.apiKey': apiKey,
    'dealerApi.secretKey': secretKey,
    'dealerApi.isActive': true,
    status: 'active',
  });

  if (!dealer) {
    throw new AppError('Invalid API credentials', 401);
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const whitelist = dealer.dealerApi?.ipWhitelist || [];

  if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
    throw new AppError('IP address not whitelisted', 403);
  }

  req.user = dealer;
  req.dealerId = dealer._id.toString();

  res.on('finish', () => {
    const responseTime = Date.now() - (req.apiStartTime || Date.now());
    ApiLog.create({
      dealerId: dealer._id,
      endpoint: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      ip: clientIp,
      requestBody: req.method !== 'GET' ? (req.body as Record<string, unknown>) : undefined,
      responseTime,
    }).catch(console.error);
  });

  next();
};
