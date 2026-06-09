import { Otp } from '../models/Otp';
import { sendOtpEmail } from './email';

export const generateOtpCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createAndSendOtp = async (email: string): Promise<void> => {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.deleteMany({ email });
  await Otp.create({ email, code, expiresAt });
  await sendOtpEmail(email, code);
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
