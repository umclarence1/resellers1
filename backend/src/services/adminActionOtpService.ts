import crypto from 'crypto';
import mongoose from 'mongoose';
import { AdminActionOtp } from '../models/AdminActionOtp';
import { sendAdminActionOtpEmail } from '../utils/email';
import { env } from '../config/env';
import { maskEmail } from './orderHistoryService';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  if (env.devSkipOtp) return '000000';
  return crypto.randomInt(100000, 1000000).toString();
}

export async function createAndSendAdminActionOtp(
  userId: mongoose.Types.ObjectId | string,
  email: string,
  options: { waitForEmail?: boolean } = {}
): Promise<{ maskedEmail: string }> {
  const normalizedEmail = email.toLowerCase();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await AdminActionOtp.findOneAndUpdate(
    { userId },
    { $set: { code, expiresAt, attempts: 0 } },
    { upsert: true }
  );

  if (!env.devSkipOtp) {
    const emailTask = sendAdminActionOtpEmail(normalizedEmail, code);
    if (options.waitForEmail) {
      await emailTask;
    } else {
      void emailTask.catch((err) => {
        console.error('[Admin action OTP email failed]', normalizedEmail, err instanceof Error ? err.message : err);
      });
    }
  }

  return { maskedEmail: maskEmail(normalizedEmail) };
}

export async function verifyAdminActionOtp(
  userId: mongoose.Types.ObjectId | string,
  code: string
): Promise<boolean> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  if (env.devSkipOtp && trimmed === '000000') return true;

  const otp = await AdminActionOtp.findOne({ userId, code: trimmed });
  if (!otp) return false;

  if (otp.expiresAt < new Date() || otp.attempts >= MAX_ATTEMPTS) {
    await AdminActionOtp.deleteOne({ _id: otp._id });
    return false;
  }

  await AdminActionOtp.deleteOne({ _id: otp._id });
  return true;
}

export async function incrementAdminActionOtpAttempts(
  userId: mongoose.Types.ObjectId | string
): Promise<void> {
  const otp = await AdminActionOtp.findOne({ userId });
  if (!otp) return;

  otp.attempts += 1;
  if (otp.attempts >= MAX_ATTEMPTS) {
    await AdminActionOtp.deleteOne({ _id: otp._id });
    return;
  }
  await otp.save();
}
