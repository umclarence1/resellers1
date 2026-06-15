import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';

const vercelRateLimitOptions = process.env.VERCEL
  ? { validate: { xForwardedForHeader: false } as const }
  : {};

function buildStore(prefix: string) {
  const redis = getRedisClient();
  if (!redis) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
  });
}

function createLimiter(prefix: string, options: Partial<Options>) {
  const store = buildStore(prefix);
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...vercelRateLimitOptions,
    ...options,
    ...(store ? { store } : {}),
  });
}

export const generalLimiter = createLimiter('general', {
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

/** Login: 5 attempts per 15 minutes per IP. */
export const loginLimiter = createLimiter('login', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

/** Registration: 3 per hour per IP. */
export const registerLimiter = createLimiter('register', {
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many registration attempts. Try again later.' },
});

export const authLimiter = createLimiter('auth', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication requests, please try again later.' },
});

export const otpLimiter = createLimiter('otp', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many OTP requests, please try again later.' },
});

export const totpLimiter = createLimiter('totp', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authenticator attempts. Try again later.' },
});

export const apiLimiter = createLimiter('api', {
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'API rate limit exceeded.' },
});

export const purchaseLimiter = createLimiter('purchase', {
  windowMs: 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many purchase attempts. Please wait a moment.' },
});

export const webhookLimiter = createLimiter('webhook', {
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'Webhook rate limit exceeded.' },
});

export const webhookVerifyLimiter = createLimiter('webhook-verify', {
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many verification requests.' },
});

export const walletFundLimiter = createLimiter('wallet-fund', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many wallet funding attempts.' },
});

export const withdrawalLimiter = createLimiter('withdrawal', {
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipFailedRequests: true,
  message: { success: false, message: 'Too many withdrawal requests. Try again later.' },
});

export const supportChatLimiter = createLimiter('support-chat', {
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many support messages. Please wait a moment.' },
});
