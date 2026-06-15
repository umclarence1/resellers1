import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Prepares the app for Cloudflare proxying:
 * - Trusts CF-Connecting-IP as the real client address
 * - Optionally requires Cloudflare ray ID in production when TRUST_CLOUDFLARE=true
 */
export function cloudflareProxyPrep(req: Request, res: Response, next: NextFunction): void {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    (req as Request & { realIp?: string }).realIp = cfIp.trim();
  }

  if (env.trustCloudflare && env.nodeEnv === 'production') {
    const ray = req.headers['cf-ray'];
    if (!ray) {
      res.status(403).json({
        success: false,
        message: 'Direct origin access is disabled. Route traffic through Cloudflare.',
      });
      return;
    }
  }

  next();
}
