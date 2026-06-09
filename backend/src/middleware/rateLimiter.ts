import rateLimit from 'express-rate-limit';

const vercelKeyGenerator = (req: { headers: Record<string, string | string[] | undefined>; ip?: string }) =>
  (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  ...(process.env.VERCEL ? { keyGenerator: vercelKeyGenerator } : {}),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests, please try again later.' },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'API rate limit exceeded.' },
});
