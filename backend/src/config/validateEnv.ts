import { env } from './env';

const INSECURE_SECRETS = new Set([
  'dev-secret-change-me',
  'dev-refresh-secret',
  'secret',
  'changeme',
]);

const REQUIRED_PRODUCTION_SECRETS = [
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'PAYSTACK_SECRET_KEY',
  'MONGODB_URI',
] as const;

export function validateProductionEnv(): void {
  if (env.nodeEnv !== 'production') return;

  const errors: string[] = [];

  for (const key of REQUIRED_PRODUCTION_SECRETS) {
    if (!process.env[key]?.trim()) {
      errors.push(`${key} must be set in production`);
    }
  }

  if (!process.env.JWT_SECRET || INSECURE_SECRETS.has(env.jwtSecret)) {
    errors.push('JWT_SECRET must be a strong random value (not a default placeholder)');
  }

  if (!process.env.REFRESH_TOKEN_SECRET || INSECURE_SECRETS.has(env.refreshTokenSecret)) {
    errors.push('REFRESH_TOKEN_SECRET must be a strong random value distinct from JWT_SECRET');
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters for TOTP and sensitive data encryption');
  }

  if (!process.env.MONGODB_URI || env.mongodbUri.includes('localhost')) {
    errors.push('MONGODB_URI must point to a production database (not localhost)');
  }

  if (env.devSkipOtp) {
    errors.push('DEV_SKIP_OTP must be false in production');
  }

  if (!env.paystack.secretKey) {
    errors.push('PAYSTACK_SECRET_KEY is required in production');
  }

  if (!env.paystack.webhookSecret && !env.paystack.secretKey) {
    errors.push('PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY is required for webhook verification');
  }

  if (!process.env.SMTP_PASS && !process.env.EMAIL_PASSWORD && !process.env.RESEND_API_KEY) {
    errors.push('RESEND_API_KEY or SMTP_PASS is required for OTP email delivery');
  }

  if (process.env.RESEND_API_KEY?.trim() && !process.env.RESEND_FROM?.trim()) {
    errors.push(
      'RESEND_FROM must be set when using Resend (verified domain, e.g. TopDealsGH <noreply@topdealsgh.com>)'
    );
  }

  if (errors.length) {
    throw new Error(`Production environment misconfiguration:\n- ${errors.join('\n- ')}`);
  }
}
