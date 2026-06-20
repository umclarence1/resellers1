import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import { AppError } from '../middleware/errorHandler';
import { generateReferralCode, isValidGhanaPhone, slugify } from '../utils/helpers';
import { validatePasswordStrength } from '../utils/password';
import { activateResellerStore } from './resellerOnboardingService';

export type CreateResellerAccountInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  activateImmediately: boolean;
};

export async function createResellerAccount(input: CreateResellerAccountInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const fullName = input.fullName.trim();

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AppError(passwordError);
  if (!isValidGhanaPhone(input.phone)) {
    throw new AppError('Phone must be 10 digits starting with 0');
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new AppError('Email already exists');

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const slug = slugify(fullName) + '-' + Date.now().toString(36);

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    phone: input.phone,
    password: hashedPassword,
    role: 'reseller',
    status: input.activateImmediately ? 'active' : 'pending',
    resellerStore: {
      storeName: `${fullName}'s Store`,
      slug,
      phone: input.phone,
      whatsapp: input.phone,
      supportEmail: normalizedEmail,
      isActive: true,
      isVerified: input.activateImmediately,
      referralCode: generateReferralCode(),
      customPrices: {},
    },
  });

  await Wallet.create({ userId: user._id });

  if (input.activateImmediately) {
    activateResellerStore(user);
    await user.save();
  }

  return user;
}
