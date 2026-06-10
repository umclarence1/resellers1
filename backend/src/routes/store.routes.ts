import { Router } from 'express';
import crypto from 'crypto';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Package, Network } from '../models/Package';
import { Faq } from '../models/Faq';
import { Order } from '../models/Order';
import { getSettings } from '../services/settingsService';
import { initializePayment } from '../utils/paystack';
import { createOrder } from '../services/orderService';
import { isValidGhanaPhone, roundMoney } from '../utils/helpers';
import { env } from '../config/env';
import { otpLimiter } from '../middleware/rateLimiter';
import { requestOrderHistoryOtp, verifyOrderHistoryOtp } from '../services/orderHistoryService';

const router = Router();

// Get store by slug
router.get('/:slug', asyncHandler(async (req, res) => {
  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    'resellerStore.isActive': true,
    role: 'reseller',
    status: 'active',
  }).select('-password');

  if (!reseller?.resellerStore) throw new AppError('Store not found', 404);

  const settings = await getSettings();

  res.json({
    success: true,
    data: {
      storeName: reseller.resellerStore.storeName,
      slug: reseller.resellerStore.slug,
      phone: reseller.resellerStore.phone,
      whatsapp: reseller.resellerStore.whatsapp,
      supportEmail: reseller.resellerStore.supportEmail,
      resellerId: reseller._id,
      isVerified: reseller.resellerStore.isVerified,
      memberSince: reseller.createdAt,
      serviceImages: settings.serviceImages,
    },
  });
}));

// Verify page
router.get('/:slug/verify', asyncHandler(async (req, res) => {
  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    role: 'reseller',
  }).select('resellerStore createdAt status');

  if (!reseller?.resellerStore) throw new AppError('Store not found', 404);

  res.json({
    success: true,
    data: {
      storeName: reseller.resellerStore.storeName,
      resellerId: reseller._id,
      verificationStatus: reseller.resellerStore.isVerified ? 'Verified Reseller' : 'Unverified',
      registrationDate: reseller.createdAt,
      activeStatus: reseller.resellerStore.isActive && reseller.status === 'active' ? 'Active' : 'Inactive',
    },
  });
}));

// Network packages for store
router.get('/:slug/packages/:network', asyncHandler(async (req, res) => {
  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    'resellerStore.isActive': true,
    role: 'reseller',
  });

  if (!reseller) throw new AppError('Store not found', 404);

  const network = decodeURIComponent(req.params.network as string) as Network;
  const packages = await Package.find({
    network,
    isEnabled: true,
  }).sort({ sortOrder: 1 });

  const priced = packages.map((pkg) => {
    const customPrice = reseller.resellerStore?.customPrices.get(pkg._id.toString());
    const price = customPrice ?? pkg.resellerBasePrice;
    return {
      id: pkg._id,
      bundleSize: pkg.bundleSize,
      price,
      basePrice: pkg.resellerBasePrice,
      maxPrice: pkg.maxSellingPrice,
    };
  });

  const prices = priced.map((p) => p.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  res.json({
    success: true,
    data: {
      network: req.params.network,
      priceRange: { min: minPrice, max: maxPrice },
      packages: priced,
    },
  });
}));

// FAQs (public)
router.get('/:slug/faqs', asyncHandler(async (_req, res) => {
  const faqs = await Faq.find({ isActive: true }).sort({ sortOrder: 1 });
  res.json({ success: true, data: faqs });
}));

// Initialize customer purchase
router.post('/:slug/purchase/init', asyncHandler(async (req, res) => {
  const { packageId, recipientPhone, email } = req.body;

  if (!packageId || !recipientPhone || !email) {
    throw new AppError('Package, recipient phone, and email are required');
  }
  if (!isValidGhanaPhone(recipientPhone)) {
    throw new AppError('Recipient number must be 10 digits');
  }

  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    'resellerStore.isActive': true,
    role: 'reseller',
  });
  if (!reseller) throw new AppError('Store not found', 404);

  const pkg = await Package.findById(packageId);
  if (!pkg || !pkg.isEnabled) throw new AppError('Package not available');

  const customPrice = reseller.resellerStore?.customPrices.get(pkg._id.toString());
  const sellingPrice = customPrice ?? pkg.resellerBasePrice;

  const settings = await getSettings();
  const processingFee = roundMoney(sellingPrice * (settings.processingFeePercent / 100));
  const total = roundMoney(sellingPrice + processingFee);

  const reference = `CUS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payment = await initializePayment(email, Math.round(total * 100), {
    type: 'customer_purchase',
    resellerId: reseller._id.toString(),
    packageId: pkg._id.toString(),
    recipientPhone,
    customerEmail: email.toLowerCase().trim(),
    sellingPrice,
    processingFee,
    expectedTotal: total,
    reference,
    storeSlug: req.params.slug,
  });

  res.json({
    success: true,
    data: {
      authorizationUrl: payment.authorization_url,
      reference: payment.reference,
    },
  });
}));

// Become a reseller (store setup after registration)
router.post('/become-reseller', asyncHandler(async (req, res) => {
  const { storeName, phone, whatsapp, supportEmail } = req.body;
  if (!storeName || !phone || !whatsapp || !supportEmail) {
    throw new AppError('All store fields are required');
  }

  res.json({
    success: true,
    message: 'Please complete registration at /register to create your reseller account',
    data: { storeName, phone, whatsapp, supportEmail },
  });
}));

// Order history (OTP protected)
router.post(
  '/:slug/history/request',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email?.trim()) throw new AppError('Email is required');

    const result = await requestOrderHistoryOtp(req.params.slug as string, email);
    res.json({
      success: true,
      message: `Verification code sent to ${result.maskedEmail}`,
      data: result,
    });
  })
);

router.post(
  '/:slug/history/verify',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    if (!email?.trim() || !code) throw new AppError('Email and verification code are required');

    const orders = await verifyOrderHistoryOtp(req.params.slug as string, email, String(code));
    res.json({ success: true, data: { orders } });
  })
);

// Order status (public with reference)
router.get('/order/:orderId', asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) throw new AppError('Order not found', 404);

  res.json({
    success: true,
    data: {
      orderId: order.orderId,
      network: order.network,
      bundleSize: order.bundleSize,
      recipientPhone: order.recipientPhone,
      status: order.status,
      createdAt: order.createdAt,
    },
  });
}));

export default router;
