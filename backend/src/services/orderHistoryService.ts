import { User } from '../models/User';
import { normalizeStoreSlug } from './storeLookupService';
import { Order } from '../models/Order';
import { StoreHistoryOtp } from '../models/StoreHistoryOtp';
import { AppError } from '../middleware/errorHandler';
import { generateOtpCode } from '../utils/otp';
import { sendOrderHistoryOtpEmail } from '../utils/email';
import { assertGhanaPhone, normalizeGhanaPhone } from '../utils/phone';
import { signSupportSession } from './supportSessionService';

/** Scope key for assistant / platform-wide order lookup (no store slug required). */
export const PLATFORM_ORDER_SCOPE = '_platform';

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

export type OrderHistoryRow = {
  orderId: string;
  network: string;
  bundleSize: string;
  recipientPhone: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
};

const getStoreReseller = async (slug: string) => {
  const normalized = normalizeStoreSlug(slug);
  const reseller = await User.findOne({
    'resellerStore.slug': normalized,
    'resellerStore.isActive': true,
    role: 'reseller',
    status: 'active',
  });
  if (!reseller) throw new AppError('Store not found', 404);
  return reseller;
};

const buildEmailOrderQuery = (resellerId: string, email: string) => {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    resellerId,
    source: 'reseller_store' as const,
    customerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') },
  };
};

/** Match recipient numbers stored as 0XXXXXXXXX, 233…, or 9-digit local. */
function recipientPhoneFilter(normalizedPhone: string): { recipientPhone: { $in: string[] } } {
  const suffix = normalizedPhone.slice(1);
  return {
    recipientPhone: {
      $in: [normalizedPhone, `233${suffix}`, `+233${suffix}`, suffix],
    },
  };
}

const buildPhoneOrderQuery = (resellerId: string, phone: string) => ({
  resellerId,
  source: 'reseller_store' as const,
  ...recipientPhoneFilter(phone),
});

const buildPlatformEmailQuery = (email: string) => {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    source: 'reseller_store' as const,
    customerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') },
  };
};

/** Platform lookup: any order delivered to this recipient number. */
const buildPlatformPhoneQuery = (phone: string) => recipientPhoneFilter(phone);

function resolveScopeSlug(slug?: string) {
  return slug && slug !== PLATFORM_ORDER_SCOPE ? slug : PLATFORM_ORDER_SCOPE;
}

function isPlatformScope(slug: string) {
  return slug === PLATFORM_ORDER_SCOPE;
}

export function mapOrdersForHistory(
  orders: Array<{
    orderId: string;
    network: string;
    bundleSize: string;
    recipientPhone: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }>
): OrderHistoryRow[] {
  return orders.map((order) => ({
    orderId: order.orderId,
    network: order.network,
    bundleSize: order.bundleSize,
    recipientPhone: order.recipientPhone,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
  }));
}

async function issueOtp(
  slug: string,
  identifier: string,
  identifierType: 'email' | 'phone',
  otpEmail: string,
  storeName: string
) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await StoreHistoryOtp.findOneAndUpdate(
    { storeSlug: slug, identifier },
    {
      $set: {
        identifierType,
        otpEmail,
        code,
        expiresAt,
        attempts: 0,
      },
    },
    { upsert: true }
  );

  await sendOrderHistoryOtpEmail(otpEmail, code, storeName);
}

export const requestOrderHistoryOtp = async (slug: string, rawEmail: string) => {
  const email = normalizeEmail(rawEmail);
  const scope = resolveScopeSlug(slug);

  if (isPlatformScope(scope)) {
    const query = buildPlatformEmailQuery(email);
    const orderCount = await Order.countDocuments(query);
    if (orderCount === 0) {
      throw new AppError('No orders found for this email');
    }
    await issueOtp(scope, email, 'email', email, 'topdealsgh');
    return {
      maskedEmail: maskEmail(email),
      orderCount,
      identifierType: 'email' as const,
    };
  }

  const reseller = await getStoreReseller(scope);
  const query = buildEmailOrderQuery(reseller._id.toString(), email);

  const orderCount = await Order.countDocuments(query);
  if (orderCount === 0) {
    throw new AppError('No orders found for this email at this store');
  }

  await issueOtp(
    scope,
    email,
    'email',
    email,
    reseller.resellerStore?.storeName || 'topdealsgh store'
  );

  return {
    maskedEmail: maskEmail(email),
    orderCount,
    identifierType: 'email' as const,
  };
};

export type PhoneOrderLookupResult = {
  orderCount: number;
  identifierType: 'phone';
  maskedEmail?: string;
  verifiedImmediately?: boolean;
  orders?: OrderHistoryRow[];
  sessionToken?: string;
};

export const requestOrderHistoryOtpByPhone = async (
  slug: string,
  rawPhone: string
): Promise<PhoneOrderLookupResult> => {
  const phone = assertGhanaPhone(rawPhone);
  const scope = resolveScopeSlug(slug);

  if (isPlatformScope(scope)) {
    const query = buildPlatformPhoneQuery(phone);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('orderId network bundleSize recipientPhone status totalAmount createdAt customerEmail');

    if (orders.length === 0) {
      throw new AppError('No orders found for this phone number');
    }

    const latestWithEmail = orders.find((o) => o.customerEmail?.trim());
    if (!latestWithEmail?.customerEmail) {
      const mapped = mapOrdersForHistory(orders);
      const sessionToken = signSupportSession({
        kind: 'store_verified',
        storeSlug: scope,
        identifier: phone,
        identifierType: 'phone',
      });
      return {
        orderCount: orders.length,
        identifierType: 'phone',
        verifiedImmediately: true,
        orders: mapped,
        sessionToken,
      };
    }

    const otpEmail = latestWithEmail.customerEmail.trim().toLowerCase();
    await issueOtp(scope, phone, 'phone', otpEmail, 'topdealsgh');
    return {
      maskedEmail: maskEmail(otpEmail),
      orderCount: orders.length,
      identifierType: 'phone',
    };
  }

  const reseller = await getStoreReseller(scope);
  const query = buildPhoneOrderQuery(reseller._id.toString(), phone);

  const latest = await Order.findOne(query).sort({ createdAt: -1 }).select('customerEmail');
  if (!latest?.customerEmail) {
    throw new AppError('No orders found for this phone number at this store');
  }

  const orderCount = await Order.countDocuments(query);
  const otpEmail = latest.customerEmail.trim().toLowerCase();

  await issueOtp(
    scope,
    phone,
    'phone',
    otpEmail,
    reseller.resellerStore?.storeName || 'topdealsgh store'
  );

  return {
    maskedEmail: maskEmail(otpEmail),
    orderCount,
    identifierType: 'phone',
  };
};

async function verifyOtpRecord(slug: string, identifier: string, code: string) {
  const record = await StoreHistoryOtp.findOne({ storeSlug: slug, identifier });
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
  return record;
}

export const verifyOrderHistoryOtp = async (slug: string, rawEmail: string, code: string) => {
  const email = normalizeEmail(rawEmail);
  const scope = resolveScopeSlug(slug);
  await verifyOtpRecord(scope, email, code);

  const query = isPlatformScope(scope)
    ? buildPlatformEmailQuery(email)
    : buildEmailOrderQuery((await getStoreReseller(scope))._id.toString(), email);

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50).select(
    'orderId network bundleSize recipientPhone status totalAmount createdAt'
  );

  const sessionToken = signSupportSession({
    kind: 'store_verified',
    storeSlug: scope,
    identifier: email,
    identifierType: 'email',
  });

  return {
    orders: mapOrdersForHistory(orders),
    sessionToken,
  };
};

export const verifyOrderHistoryOtpByPhone = async (slug: string, rawPhone: string, code: string) => {
  const phone = assertGhanaPhone(rawPhone);
  const scope = resolveScopeSlug(slug);
  await verifyOtpRecord(scope, phone, code);

  const query = isPlatformScope(scope)
    ? buildPlatformPhoneQuery(phone)
    : buildPhoneOrderQuery((await getStoreReseller(scope))._id.toString(), phone);

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50).select(
    'orderId network bundleSize recipientPhone status totalAmount createdAt'
  );

  const sessionToken = signSupportSession({
    kind: 'store_verified',
    storeSlug: scope,
    identifier: phone,
    identifierType: 'phone',
  });

  return {
    orders: mapOrdersForHistory(orders),
    sessionToken,
  };
};

export async function getVerifiedStoreOrders(
  slug: string,
  identifier: string,
  identifierType: 'email' | 'phone'
): Promise<OrderHistoryRow[]> {
  const scope = resolveScopeSlug(slug);

  const query =
    identifierType === 'email'
      ? isPlatformScope(scope)
        ? buildPlatformEmailQuery(identifier)
        : buildEmailOrderQuery((await getStoreReseller(scope))._id.toString(), identifier)
      : isPlatformScope(scope)
        ? buildPlatformPhoneQuery(identifier)
        : buildPhoneOrderQuery((await getStoreReseller(scope))._id.toString(), identifier);

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50).select(
    'orderId network bundleSize recipientPhone status totalAmount createdAt'
  );
  return mapOrdersForHistory(orders);
}

/** Resolve store slug for an order (complaints, etc.). */
export async function getOrderStoreSlug(orderId: string): Promise<string | null> {
  const order = await Order.findOne({ orderId, source: 'reseller_store' }).select('resellerId');
  if (!order?.resellerId) return null;
  const reseller = await User.findById(order.resellerId).select('resellerStore.slug');
  return reseller?.resellerStore?.slug ?? null;
}
