import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User';
import { PasswordReset } from '../models/PasswordReset';
import { Wallet } from '../models/Wallet';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { createAndSendOtp, verifyOtp, incrementOtpAttempts } from '../utils/otp';
import { signToken } from '../utils/jwt';
import { sendPasswordResetEmail } from '../utils/email';
import { env } from '../config/env';
import {
  generateReferralCode,
  isValidGhanaPhone,
  slugify,
} from '../utils/helpers';
import { validatePasswordStrength } from '../utils/password';

const router = Router();

const sanitizeUser = (user: InstanceType<typeof User>) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  resellerStore: user.resellerStore,
  dealerApi: user.dealerApi
    ? { apiKey: user.dealerApi.apiKey, isActive: user.dealerApi.isActive }
    : undefined,
});

const issueToken = (user: InstanceType<typeof User>) => {
  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { token, user: sanitizeUser(user) };
};

// Reseller registration
router.post(
  '/register/reseller',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { fullName, email, phone, password, confirmPassword } = req.body;

    if (!fullName || !email || !phone || !password || !confirmPassword) {
      throw new AppError('All fields are required');
    }
    if (password !== confirmPassword) {
      throw new AppError('Passwords do not match');
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new AppError(passwordError);
    if (!isValidGhanaPhone(phone)) {
      throw new AppError('Phone must be 10 digits starting with 0');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new AppError('Email already registered');

    const hashedPassword = await bcrypt.hash(password, 12);
    const slug = slugify(fullName) + '-' + Date.now().toString(36);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: 'reseller',
      status: 'pending',
      resellerStore: {
        storeName: fullName + "'s Store",
        slug,
        phone,
        whatsapp: phone,
        supportEmail: email.toLowerCase(),
        isActive: false,
        isVerified: false,
        referralCode: generateReferralCode(),
        customPrices: {},
      },
    });

    await Wallet.create({ userId: user._id });

    if (env.devSkipOtp) {
      user.status = 'active';
      if (user.resellerStore) user.resellerStore.isActive = true;
      await user.save();
      const result = issueToken(user);
      res.status(201).json({
        success: true,
        message: 'Registration successful (dev mode)',
        data: { ...result, requiresOtp: false },
      });
      return;
    }

    await createAndSendOtp(email);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify OTP sent to your email.',
      data: { email: user.email, requiresOtp: true },
    });
  })
);

// Login step 1 - credentials
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password) throw new AppError('Email and password required');

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new AppError('Invalid credentials');

    if (!role) throw new AppError('Login portal is required');
    if (user.role !== role) {
      throw new AppError('Invalid credentials for this portal');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid credentials');

    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended');
    }

    // Dev mode: skip OTP so dashboards can be built without email integration
    if (env.devSkipOtp) {
      user.lastLogin = new Date();
      if (user.status === 'pending' && user.role === 'reseller') {
        user.status = 'active';
        if (user.resellerStore) user.resellerStore.isActive = true;
      }
      await user.save();
      const result = issueToken(user);
      res.json({
        success: true,
        message: 'Login successful (dev mode — OTP skipped)',
        data: { ...result, requiresOtp: false },
      });
      return;
    }

    await createAndSendOtp(email);

    res.json({
      success: true,
      message: 'OTP sent to your email',
      data: { email: user.email, role: user.role, requiresOtp: true },
    });
  })
);

// Login step 2 - OTP verification
router.post(
  '/verify-otp',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw new AppError('Email and OTP required');

    const valid = await verifyOtp(email, otp);
    if (!valid) {
      await incrementOtpAttempts(email);
      throw new AppError('Invalid or expired OTP');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new AppError('User not found');

    user.lastLogin = new Date();
    if (user.status === 'pending' && user.role === 'reseller') {
      user.status = 'active';
      if (user.resellerStore) user.resellerStore.isActive = true;
    }
    await user.save();

    const result = issueToken(user);
    res.json({ success: true, message: 'Login successful', data: result });
  })
);

// Resend OTP
router.post(
  '/resend-otp',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) throw new AppError('Email required');

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new AppError('User not found');

    await createAndSendOtp(email);
    res.json({ success: true, message: 'OTP resent successfully' });
  })
);

// Forgot password (resellers only — dealers are admin-managed)
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    if (!email) throw new AppError('Email required');

    if (role && role !== 'reseller') {
      throw new AppError('Password reset is only available for reseller accounts');
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: 'reseller',
    });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await PasswordReset.deleteMany({ email: email.toLowerCase() });
      await PasswordReset.create({
        email: email.toLowerCase(),
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetLink);
    }

    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent to your email.',
    });
  })
);

// Reset password
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      throw new AppError('All fields required');
    }
    if (password !== confirmPassword) throw new AppError('Passwords do not match');
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new AppError(passwordError);

    const reset = await PasswordReset.findOne({ token, used: false });
    if (!reset || reset.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset link');
    }

    const user = await User.findOne({ email: reset.email, role: 'reseller' });
    if (!user) throw new AppError('User not found');

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    reset.used = true;
    await reset.save();

    res.json({ success: true, message: 'Password reset successful' });
  })
);

// Get current user
router.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);

    const { verifyToken } = await import('../utils/jwt');
    const payload = verifyToken(authHeader.split(' ')[1]);
    const user = await User.findById(payload.userId);
    if (!user || user.status === 'suspended') {
      throw new AppError('Account not found or suspended', 401);
    }

    res.json({ success: true, data: sanitizeUser(user) });
  })
);

export default router;
