import { User } from '../models/User';
import { Order } from '../models/Order';
import { StoreHistoryOtp } from '../models/StoreHistoryOtp';
import { AppError } from '../middleware/errorHandler';
import { generateOtpCode } from '../utils/otp';
import { sendOrderHistoryOtpEmail } from '../utils/email';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const maskEmail = (email: string): string => {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 1);
  return `${visible}***@${domain}`;
};

const normalizeEmail = (raw: string) => {
  const value = raw.trim().toLowerCase();
  if (!isEmail(value)) {
    throw new AppError('Enter a valid email address');
  }
  return value;
};

const getStoreReseller = async (slug: string) => {
  const reseller = await User.findOne({
    'resellerStore.slug': slug,
    'resellerStore.isActive': true,
    role: 'reseller',
    status: 'active',
  });
  if (!reseller) throw new AppError('Store not found', 404);
  return reseller;
};

const buildOrderQuery = (resellerId: string, email: string) => {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    resellerId,
    source: 'reseller_store' as const,
    customerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') },
  };
};

export const requestOrderHistoryOtp = async (slug: string, rawEmail: string) => {
  const email = normalizeEmail(rawEmail);
  const reseller = await getStoreReseller(slug);
  const query = buildOrderQuery(reseller._id.toString(), email);

  const orderCount = await Order.countDocuments(query);
  if (orderCount === 0) {
    throw new AppError('No orders found for this email at this store');
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await StoreHistoryOtp.deleteMany({ storeSlug: slug, identifier: email });
  await StoreHistoryOtp.create({
    storeSlug: slug,
    identifier: email,
    identifierType: 'email',
    otpEmail: email,
    code,
    expiresAt,
  });

  await sendOrderHistoryOtpEmail(email, code, reseller.resellerStore?.storeName || 'DataBundle Store');

  return {
    maskedEmail: maskEmail(email),
    orderCount,
  };
};

export const verifyOrderHistoryOtp = async (slug: string, rawEmail: string, code: string) => {
  const email = normalizeEmail(rawEmail);
  const reseller = await getStoreReseller(slug);

  const record = await StoreHistoryOtp.findOne({ storeSlug: slug, identifier: email });
  if (!record) throw new AppError('Verification code expired or not found. Request a new one.');
  if (record.expiresAt < new Date()) {
    await StoreHistoryOtp.deleteOne({ _id: record._id });
    throw new AppError('Verification code has expired. Request a new one.');
  }
  if (record.attempts >= 5) {
    await StoreHistoryOtp.deleteOne({ _id: record._id });
    throw new AppError('Too many attempts. Request a new code.');
  }
  if (record.code !== code) {
    record.attempts += 1;
    await record.save();
    throw new AppError('Invalid verification code');
  }

  await StoreHistoryOtp.deleteOne({ _id: record._id });

  const query = buildOrderQuery(reseller._id.toString(), email);
  const orders = await Order.find(query).sort({ createdAt: -1 }).select(
    'orderId network bundleSize recipientPhone status totalAmount createdAt'
  );

  return orders.map((order) => ({
    orderId: order.orderId,
    network: order.network,
    bundleSize: order.bundleSize,
    recipientPhone: order.recipientPhone,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
  }));
};
