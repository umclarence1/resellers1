import crypto from 'crypto';
import { Otp } from '../models/Otp';
import { EmailDeliveryError, sendOtpEmail } from './email';

export const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

type OtpSendOptions = {
  /** Wait for SMTP/API delivery (use on resend so failures surface to the user). */
  waitForEmail?: boolean;
};

/** Save OTP and dispatch email. */
export const createAndSendOtp = async (
  email: string,
  options: OtpSendOptions = {}
): Promise<void> => {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const normalized = email.toLowerCase();

  await Otp.findOneAndUpdate(
    { email: normalized },
    { $set: { code, expiresAt, attempts: 0 } },
    { upsert: true }
  );

  const emailTask = sendOtpEmail(normalized, code);

  if (options.waitForEmail) {
    await emailTask;
    return;
  }

  void emailTask.catch((err) => {
    console.error('[OTP email failed]', normalized, err instanceof Error ? err.message : err);
  });
};

/** Registration/login paths that must confirm delivery before telling the user an OTP was sent. */
export const sendAuthOtpOrFail = async (email: string): Promise<void> => {
  try {
    await createAndSendOtp(email, { waitForEmail: true });
  } catch (err) {
    if (err instanceof EmailDeliveryError) throw err;
    console.error('[OTP email failed]', email.toLowerCase(), err instanceof Error ? err.message : err);
    throw new EmailDeliveryError();
  }
};

export const verifyOtp = async (email: string, code: string): Promise<boolean> => {
  const otp = await Otp.findOne({ email: email.toLowerCase(), code });

  if (!otp) return false;
  if (otp.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otp._id });
    return false;
  }

  if (otp.attempts >= 5) {
    await Otp.deleteOne({ _id: otp._id });
    return false;
  }

  await Otp.deleteOne({ _id: otp._id });
  return true;
};

export const incrementOtpAttempts = async (email: string): Promise<void> => {
  await Otp.updateOne({ email: email.toLowerCase() }, { $inc: { attempts: 1 } });
};
