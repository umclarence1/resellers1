import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Package, Network } from '../models/Package';
import { Order } from '../models/Order';
import { Withdrawal } from '../models/Withdrawal';
import { Complaint } from '../models/Complaint';
import { Notification } from '../models/Notification';
import { getDateRanges, slugify, isValidGhanaPhone } from '../utils/helpers';
import { getOrCreateWallet } from '../services/walletService';
import { validateResellerPrice } from '../services/orderService';
import { computeResellerProfit, resellerProfitRange } from '../services/resellerProfitService';
import { getNetworkStockList } from '../services/networkStockService';
import { getAfaStock } from '../services/afaStockService';
import { getSettings } from '../services/settingsService';
import { canSubmitComplaint, isComplaintsEnabledForUser } from '../services/settingsService';
import {
  requestWithdrawal,
  getWithdrawalSummary,
} from '../services/withdrawalService';
import { upload } from '../middleware/upload';
import { withdrawalLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';
import { buildStoreShareUrl } from '../config/urls';
import { getOrderGrowthChart } from '../services/growthChartService';
import {
  getOrderTracking,
  syncFulfillmentStatuses,
  syncInFlightOrders,
  getFulfillmentStatusCounts,
} from '../services/fulfillmentProviderService';
import {
  getCustomPrice,
  getResellerPricingStatus,
  RESELLER_STORE_NETWORKS,
} from '../services/resellerStoreReadinessService';
import { activateResellerStore } from '../services/resellerOnboardingService';

const router = Router();
router.use(authenticate, authorize('reseller'));

// Dashboard
router.get('/dashboard', asyncHandler(async (req: AuthRequest, res) => {
  const resellerId = req.user!._id;
  void syncFulfillmentStatuses({ resellerId }, 15).catch(() => {});

  const { startOfToday, startOfWeek, startOfMonth } = getDateRanges();
  const wallet = await getOrCreateWallet(resellerId);
  const fulfillmentCounts = await getFulfillmentStatusCounts({ resellerId });

  const [
    ordersToday, ordersWeek, ordersMonth,
    successful, failed, pending, processing,
    revenueAgg, profitToday, profitWeek, profitMonth, profitLifetime,
  ] = await Promise.all([
    Order.countDocuments({ resellerId, createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ resellerId, createdAt: { $gte: startOfWeek } }),
    Order.countDocuments({ resellerId, createdAt: { $gte: startOfMonth } }),
    Order.countDocuments({ resellerId, status: 'delivered' }),
    Order.countDocuments({ resellerId, status: 'failed' }),
    Order.countDocuments({ resellerId, status: 'pending' }),
    Order.countDocuments({ resellerId, status: 'processing' }),
    Order.aggregate([{ $match: { resellerId } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { resellerId, createdAt: { $gte: startOfToday } } }, { $group: { _id: null, total: { $sum: '$profit' } } }]),
    Order.aggregate([{ $match: { resellerId, createdAt: { $gte: startOfWeek } } }, { $group: { _id: null, total: { $sum: '$profit' } } }]),
    Order.aggregate([{ $match: { resellerId, createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$profit' } } }]),
    Order.aggregate([{ $match: { resellerId } }, { $group: { _id: null, total: { $sum: '$profit' } } }]),
  ]);

  const growthChart = await getOrderGrowthChart({ resellerId }, 14, 'profit');
  const user = await User.findById(resellerId);
  const pricing = user?.resellerStore
    ? await getResellerPricingStatus(user)
    : { pricesReady: false, configuredCount: 0, requiredCount: 0, networksMissing: [] as string[] };
  const canShareLink = Boolean(
    pricing.pricesReady && user?.resellerStore?.isActive && user.resellerStore.slug
  );

  res.json({
    success: true,
    data: {
      walletBalance: wallet.balance,
      ordersToday,
      ordersThisWeek: ordersWeek,
      ordersThisMonth: ordersMonth,
      successfulOrders: successful,
      failedOrders: failed,
      pendingOrders: pending,
      processingOrders: processing,
      totalRevenue: revenueAgg[0]?.total || 0,
      growthChart,
      totalProfit: profitLifetime[0]?.total || 0,
      withdrawableProfit: wallet.profitBalance,
      profitToday: profitToday[0]?.total || 0,
      profitThisWeek: profitWeek[0]?.total || 0,
      profitThisMonth: profitMonth[0]?.total || 0,
      ...fulfillmentCounts,
      pricesReady: pricing.pricesReady,
      configuredCount: pricing.configuredCount,
      requiredCount: pricing.requiredCount,
      networksMissing: pricing.networksMissing,
      canShareLink,
      storeUrl: canShareLink ? buildStoreShareUrl(user!.resellerStore!.slug) : null,
    },
  });
}));

const generateUniqueStoreSlug = async (storeName: string, excludeUserId: string): Promise<string> => {
  const base = slugify(storeName) || 'my-store';
  let slug = base;
  let counter = 1;
  while (await User.findOne({ 'resellerStore.slug': slug, _id: { $ne: excludeUserId } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
};

// Store setup
router.get('/store', asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!._id);
  if (!user?.resellerStore) throw new AppError('Store not found');

  const pricing = await getResellerPricingStatus(user);
  const canShareLink = pricing.pricesReady && user.resellerStore.isActive;
  const networkStock = await getNetworkStockList();

  res.json({
    success: true,
    data: {
      storeName: user.resellerStore.storeName,
      slug: user.resellerStore.slug,
      phone: user.resellerStore.phone,
      whatsapp: user.resellerStore.whatsapp,
      supportEmail: user.resellerStore.supportEmail,
      isActive: user.resellerStore.isActive,
      pricesReady: pricing.pricesReady,
      configuredCount: pricing.configuredCount,
      requiredCount: pricing.requiredCount,
      networksMissing: pricing.networksMissing,
      networkStock,
      canShareLink,
      storeUrl: canShareLink ? buildStoreShareUrl(user.resellerStore.slug) : null,
    },
  });
}));

router.put('/store', asyncHandler(async (req: AuthRequest, res) => {
  const { storeName, phone, whatsapp, supportEmail } = req.body;
  const user = await User.findById(req.user!._id);
  if (!user?.resellerStore) throw new AppError('Store not found');

  if (!storeName?.trim()) throw new AppError('Store name is required');
  if (storeName.trim().length < 2) throw new AppError('Store name must be at least 2 characters');
  if (phone && !isValidGhanaPhone(phone)) throw new AppError('Phone must be 10 digits starting with 0');
  if (whatsapp && !isValidGhanaPhone(whatsapp)) throw new AppError('WhatsApp must be 10 digits starting with 0');

  user.resellerStore.storeName = storeName.trim();
  user.resellerStore.slug = await generateUniqueStoreSlug(storeName, user._id.toString());
  if (phone) user.resellerStore.phone = phone;
  if (whatsapp) user.resellerStore.whatsapp = whatsapp;
  if (supportEmail) user.resellerStore.supportEmail = supportEmail.toLowerCase().trim();
  activateResellerStore(user);
  await user.save();

  const pricing = await getResellerPricingStatus(user);
  const canShareLink = pricing.pricesReady && user.resellerStore.isActive;

  res.json({
    success: true,
    message: 'Store updated successfully',
    data: {
      storeName: user.resellerStore.storeName,
      slug: user.resellerStore.slug,
      phone: user.resellerStore.phone,
      whatsapp: user.resellerStore.whatsapp,
      supportEmail: user.resellerStore.supportEmail,
      isActive: user.resellerStore.isActive,
      pricesReady: pricing.pricesReady,
      configuredCount: pricing.configuredCount,
      requiredCount: pricing.requiredCount,
      networksMissing: pricing.networksMissing,
      canShareLink,
      storeUrl: canShareLink ? buildStoreShareUrl(user.resellerStore.slug) : null,
    },
  });
}));

// Price management
router.get('/network-stock', asyncHandler(async (_req, res) => {
  const data = await getNetworkStockList();
  res.json({ success: true, data });
}));

router.get('/prices', asyncHandler(async (req: AuthRequest, res) => {
  const stock = await getNetworkStockList();
  const afaStock = await getAfaStock();
  const packages = await Package.find({
    isEnabled: true,
    network: { $in: RESELLER_STORE_NETWORKS },
  }).sort({ network: 1, sortOrder: 1 });

  const user = await User.findById(req.user!._id);
  if (!user?.resellerStore) throw new AppError('Store not found');

  const pricing = await getResellerPricingStatus(user);

  const data = packages.map((pkg) => {
    const custom = getCustomPrice(user, pkg._id.toString());
    const myPrice = custom ?? pkg.resellerBasePrice;
    return {
      _id: pkg._id,
      network: pkg.network,
      bundleSize: pkg.bundleSize,
      resellerBasePrice: pkg.resellerBasePrice,
      maxSellingPrice: pkg.maxSellingPrice,
      myPrice,
      hasCustomPrice: custom !== undefined,
      profitPerSale: computeResellerProfit(myPrice, pkg.resellerBasePrice),
      ...resellerProfitRange(pkg.resellerBasePrice, pkg.maxSellingPrice),
    };
  });
  res.json({
    success: true,
    data,
    meta: {
      pricesReady: pricing.pricesReady,
      configuredCount: pricing.configuredCount,
      requiredCount: pricing.requiredCount,
      networksMissing: pricing.networksMissing,
      networkStock: stock,
      afaStock,
    },
  });
}));

router.put('/prices/:packageId', asyncHandler(async (req: AuthRequest, res) => {
  const { price } = req.body;
  const pkg = await Package.findById(req.params.packageId);
  if (!pkg) throw new AppError('Package not found');
  if (!RESELLER_STORE_NETWORKS.includes(pkg.network as (typeof RESELLER_STORE_NETWORKS)[number])) {
    throw new AppError('This package cannot be priced');
  }

  validateResellerPrice(price, pkg.resellerBasePrice, pkg.maxSellingPrice);

  const user = await User.findById(req.user!._id);
  if (!user?.resellerStore) throw new AppError('Store not found');

  if (!user.resellerStore.customPrices) {
    user.resellerStore.customPrices = new Map();
  }
  user.resellerStore.customPrices.set(pkg._id.toString(), price);
  user.markModified('resellerStore.customPrices');
  await user.save();

  const profitPerSale = computeResellerProfit(price, pkg.resellerBasePrice);

  res.json({
    success: true,
    message: 'Price updated',
    data: {
      packageId: pkg._id,
      price,
      resellerBasePrice: pkg.resellerBasePrice,
      profitPerSale,
    },
  });
}));

// Orders (store purchases)
router.get('/orders', asyncHandler(async (req: AuthRequest, res) => {
  const orders = await Order.find({
    resellerId: req.user!._id,
    source: 'reseller_store',
  })
    .sort({ createdAt: -1 })
    .limit(200);

  await syncInFlightOrders(orders);

  const refreshed = await Order.find({
    resellerId: req.user!._id,
    source: 'reseller_store',
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .select(
      'orderId customerEmail recipientPhone network bundleSize status providerStatus providerReference totalAmount sellingPrice createdAt updatedAt'
    );

  res.json({ success: true, data: refreshed });
}));

router.get('/orders/:orderId/tracking', asyncHandler(async (req: AuthRequest, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    resellerId: req.user!._id,
    source: 'reseller_store',
  });
  if (!order) throw new AppError('Order not found');
  res.json({ success: true, data: getOrderTracking(order, { forClient: true }) });
}));

// Withdrawals
router.get('/withdrawals/summary', asyncHandler(async (req: AuthRequest, res) => {
  const summary = await getWithdrawalSummary(req.user!._id);
  res.json({ success: true, data: summary });
}));

router.post('/withdrawals', withdrawalLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const withdrawal = await requestWithdrawal(req.user!._id, req.body);
  res.status(201).json({ success: true, data: withdrawal });
}));

router.get('/withdrawals', asyncHandler(async (req: AuthRequest, res) => {
  const withdrawals = await Withdrawal.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
}));

// Complaints
router.get('/complaints/eligible-orders', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!._id.toString();
  const complaintsEnabled = await isComplaintsEnabledForUser(userId);

  const orders = await Order.find({
    resellerId: req.user!._id,
    source: 'reseller_store',
    status: { $nin: ['refunded', 'cancelled'] },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('orderId recipientPhone customerEmail network bundleSize status createdAt');

  const submitted = await Complaint.find({ userId: req.user!._id }).distinct('orderId');
  const submittedSet = new Set(submitted);

  const eligible = await Promise.all(
    orders.map(async (order) => {
      const check = await canSubmitComplaint(userId, {
        orderId: order.orderId,
        network: order.network,
        status: order.status,
        createdAt: order.createdAt,
      });
      return {
        orderId: order.orderId,
        recipientPhone: order.recipientPhone,
        customerEmail: order.customerEmail,
        network: order.network,
        bundleSize: order.bundleSize,
        status: order.status,
        createdAt: order.createdAt,
        canComplain: complaintsEnabled && check.allowed,
        reason: check.reason,
        hasComplaint: submittedSet.has(order.orderId),
      };
    })
  );

  res.json({
    success: true,
    data: { complaintsEnabled, orders: eligible },
  });
}));

router.post('/complaints', upload.single('screenshot'), asyncHandler(async (req: AuthRequest, res) => {
  const { orderId, issueType, description } = req.body;
  if (!orderId) throw new AppError('Order ID is required');

  const order = await Order.findOne({ orderId, resellerId: req.user!._id });
  if (!order) throw new AppError('Order not found');

  const check = await canSubmitComplaint(req.user!._id.toString(), {
    orderId: order.orderId,
    network: order.network,
    status: order.status,
    createdAt: order.createdAt,
  });
  if (!check.allowed) throw new AppError(check.reason || 'Cannot submit complaint');

  const screenshotUrl = req.file ? `/${env.uploadDir}/${req.file.filename}` : undefined;

  const complaint = await Complaint.create({
    orderId,
    userId: req.user!._id,
    phoneNumber: order.recipientPhone,
    issueType: issueType || 'Data Not Received',
    description: description || 'Data not received after 2+ hours',
    screenshotUrl,
  });

  res.status(201).json({ success: true, message: 'Complaint submitted', data: complaint });
}));

router.get('/complaints', asyncHandler(async (req: AuthRequest, res) => {
  const complaints = await Complaint.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: complaints });
}));

// Notifications
router.get('/notifications', asyncHandler(async (req: AuthRequest, res) => {
  const notifications = await Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: notifications });
}));

router.patch('/notifications/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user!._id }, { isRead: true });
  res.json({ success: true, message: 'Marked as read' });
}));

export default router;
