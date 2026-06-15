import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import { logSecurityEvent } from '../services/securityAuditService';

/** Paystack webhook egress IPs (https://paystack.com/docs/payments/webhooks/) */
const DEFAULT_PAYSTACK_IPS = new Set([
  '52.31.156.142',
  '52.49.173.169',
  '52.214.14.220',
]);

function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || '';
  }
  return req.ip || '';
}

export function paystackIpAllowlist(req: Request, res: Response, next: NextFunction): void {
  if (env.nodeEnv !== 'production') {
    next();
    return;
  }

  const allowlist = env.paystack.webhookIps.length
    ? new Set(env.paystack.webhookIps)
    : DEFAULT_PAYSTACK_IPS;

  const ip = clientIp(req);
  if (!allowlist.has(ip)) {
    void logSecurityEvent({
      action: 'webhook_rejected',
      entity: 'paystack',
      details: { reason: 'ip_not_allowlisted', ip },
      ip,
      success: false,
    });
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  next();
}

export function assertTrustedWebhookSource(req: Request): void {
  if (env.nodeEnv !== 'production') return;

  const allowlist = env.paystack.webhookIps.length
    ? new Set(env.paystack.webhookIps)
    : DEFAULT_PAYSTACK_IPS;

  const ip = clientIp(req);
  if (!allowlist.has(ip)) {
    throw new AppError('Webhook source not trusted', 403);
  }
}
