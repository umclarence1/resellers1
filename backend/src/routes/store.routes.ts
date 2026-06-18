import { Router } from 'express';
import crypto from 'crypto';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Package, Network } from '../models/Package';
import { Faq } from '../models/Faq';
import { Order } from '../models/Order';
import { getSettings } from '../services/settingsService';
import { initializePayment } from '../utils/paystack';
import { isValidGhanaPhone, roundMoney } from '../utils/helpers';
import { assertNetworkInStock } from '../services/networkStockService';
import { assertAfaInStock, getAfaStock } from '../services/afaStockService';
import { getAfaPackage } from '../services/afaPackageService';
import { isAfaProduct, AFA_CHECK_USSD, AFA_PROCESSING_HOURS } from '../config/afa';
import { validateAfaDetails } from '../services/orderService';
import { env } from '../config/env';
import { otpLimiter, purchaseLimiter } from '../middleware/rateLimiter';
import { rejectFields } from '../middleware/rejectFields';

const blockStorePricing = rejectFields(
  'sellingPrice',
  'costPrice',
  'totalAmount',
  'profit',
  'processingFee',
  'expectedTotal'
);
import {
  requestOrderHistoryOtp,
  requestOrderHistoryOtpByPhone,
  verifyOrderHistoryOtp,
  verifyOrderHistoryOtpByPhone,
} from '../services/orderHistoryService';

const router = Router();

// Get store by slug
router.get('/:slug', asyncHandler(async (req, res) => {
  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    role: 'reseller',
  }).select('-password');

  if (!reseller?.resellerStore) throw new AppError('Store not found', 404);
  if (!reseller.resellerStore.isActive || reseller.status !== 'active') {
    throw new AppError('This store is currently unavailable', 403);
  }

  const settings = await getSettings();
  const afaStock = await getAfaStock();

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
      afa: {
        inStock: afaStock.inStock,
        imageUrl: afaStock.imageUrl,
        processingHours: AFA_PROCESSING_HOURS,
        checkUssd: AFA_CHECK_USSD,
      },
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
  await assertNetworkInStock(network);

  const packages = await Package.find({
    network,
    productType: 'data',
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

router.get('/:slug/afa', asyncHandler(async (req, res) => {
  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    'resellerStore.isActive': true,
    role: 'reseller',
  });
  if (!reseller) throw new AppError('Store not found', 404);

  const [stock, pkg] = await Promise.all([getAfaStock(), getAfaPackage()]);
  if (!pkg || !pkg.isEnabled) throw new AppError('AFA registration is not available', 503);

  const customPrice = reseller.resellerStore?.customPrices.get(pkg._id.toString());
  const price = customPrice ?? pkg.resellerBasePrice;

  res.json({
    success: true,
    data: {
      packageId: pkg._id,
      bundleSize: pkg.bundleSize,
      price,
      basePrice: pkg.resellerBasePrice,
      maxPrice: pkg.maxSellingPrice,
      inStock: stock.inStock,
      imageUrl: stock.imageUrl,
      processingHours: AFA_PROCESSING_HOURS,
      checkUssd: AFA_CHECK_USSD,
    },
  });
}));

// FAQs (public)
router.get('/:slug/faqs', asyncHandler(async (_req, res) => {
  const faqs = await Faq.find({ isActive: true }).sort({ sortOrder: 1 });
  res.json({ success: true, data: faqs });
}));

// Initialize customer purchase
router.post('/:slug/purchase/init', purchaseLimiter, blockStorePricing, asyncHandler(async (req, res) => {
  const { packageId, recipientPhone, email, fullName, ghanaCard, location, occupation } = req.body;

  if (!packageId || !email) {
    throw new AppError('Package and email are required');
  }

  const reseller = await User.findOne({
    'resellerStore.slug': req.params.slug,
    'resellerStore.isActive': true,
    role: 'reseller',
  });
  if (!reseller) throw new AppError('Store not found', 404);

  const pkg = await Package.findById(packageId);
  if (!pkg || !pkg.isEnabled) throw new AppError('Package not available');

  const isAfa = isAfaProduct(pkg.productType, pkg.bundleSize);
  let afaDetails: ReturnType<typeof validateAfaDetails> | undefined;
  let phone = recipientPhone;

  if (isAfa) {
    await assertAfaInStock();
    afaDetails = validateAfaDetails({ fullName, phone: recipientPhone, ghanaCard, location, occupation });
    phone = afaDetails.phone;
  } else {
    if (!recipientPhone) throw new AppError('Recipient phone is required');
    if (!isValidGhanaPhone(recipientPhone)) {
      throw new AppError('Recipient number must be 10 digits');
    }
    await assertNetworkInStock(pkg.network);
  }

  const customPrice = reseller.resellerStore?.customPrices.get(pkg._id.toString());
  const sellingPrice = customPrice ?? pkg.resellerBasePrice;

  const settings = await getSettings();
  const paystackChargePercent = settings.paystackChargePercent ?? 2;
  const processingFee = roundMoney(sellingPrice * (paystackChargePercent / 100));
  const total = roundMoney(sellingPrice + processingFee);

  const reference = `CUS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payment = await initializePayment(email, Math.round(total * 100), {
    type: 'customer_purchase',
    resellerId: reseller._id.toString(),
    packageId: pkg._id.toString(),
    recipientPhone: phone,
    customerEmail: email.toLowerCase().trim(),
    sellingPrice,
    processingFee,
    expectedTotal: total,
    reference,
    storeSlug: req.params.slug,
    ...(afaDetails
      ? {
          afaDetails: {
            fullName: afaDetails.fullName,
            phone: afaDetails.phone,
            ghanaCard: afaDetails.ghanaCard,
            location: afaDetails.location,
            occupation: afaDetails.occupation,
          },
        }
      : {}),
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
    res.json({ success: true, data: orders });
  })
);

router.post(
  '/:slug/history/request-phone',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone?.trim()) throw new AppError('Phone number is required');

    const result = await requestOrderHistoryOtpByPhone(req.params.slug as string, phone);
    res.json({
      success: true,
      message: `Verification code sent to ${result.maskedEmail}`,
      data: result,
    });
  })
);

router.post(
  '/:slug/history/verify-phone',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body;
    if (!phone?.trim() || !code) throw new AppError('Phone and verification code are required');

    const result = await verifyOrderHistoryOtpByPhone(
      req.params.slug as string,
      phone,
      String(code)
    );
    res.json({ success: true, data: result });
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
