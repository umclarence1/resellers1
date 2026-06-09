import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { Package } from '../models/Package';
import { Order } from '../models/Order';
import { ApiLog } from '../models/ApiLog';
import { Notification } from '../models/Notification';
import { getDateRanges } from '../utils/helpers';
import { getOrCreateWallet } from '../services/walletService';
import { createOrder, validateBulkOrders, processBulkOrders } from '../services/orderService';
import { getSettings } from '../services/settingsService';
import { initializePayment, calculatePaystackCharge } from '../utils/paystack';
import { env } from '../config/env';
import { User } from '../models/User';
import crypto from 'crypto';

const router = Router();
router.use(authenticate, authorize('dealer'));

// Dashboard
router.get('/dashboard', asyncHandler(async (req: AuthRequest, res) => {
  const dealerId = req.user!._id;
  const { startOfToday, startOfWeek, startOfMonth } = getDateRanges();
  const wallet = await getOrCreateWallet(dealerId);

  const [ordersToday, ordersWeek, ordersMonth, purchaseAgg, revenueAgg] = await Promise.all([
    Order.countDocuments({ dealerId, createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ dealerId, createdAt: { $gte: startOfWeek } }),
    Order.countDocuments({ dealerId, createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $match: { dealerId } },
      { $group: { _id: null, total: { $sum: '$sellingPrice' } } },
    ]),
    Order.aggregate([
      { $match: { dealerId, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$sellingPrice' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      walletBalance: wallet.balance,
      ordersToday,
      ordersThisWeek: ordersWeek,
      ordersThisMonth: ordersMonth,
      totalPurchases: purchaseAgg[0]?.total || 0,
      totalRevenue: revenueAgg[0]?.total || 0,
    },
  });
}));

// Wallet
router.get('/wallet', asyncHandler(async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet(req.user!._id);
  res.json({ success: true, data: wallet });
}));

// Fund wallet via Paystack
router.post('/wallet/fund', asyncHandler(async (req: AuthRequest, res) => {
  const { amount } = req.body;
  if (!amount || amount < 1) throw new AppError('Minimum deposit is GHS 1');

  const settings = await getSettings();
  const charge = calculatePaystackCharge(amount, settings.paystackChargePercent);
  const total = amount + charge;

  const reference = `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payment = await initializePayment(
    req.user!.email,
    Math.round(total * 100),
    {
      type: 'wallet_deposit',
      userId: req.user!._id.toString(),
      depositAmount: amount,
      paystackCharge: charge,
      reference,
    }
  );

  res.json({
    success: true,
    data: {
      authorizationUrl: payment.authorization_url,
      reference: payment.reference,
      depositAmount: amount,
      paystackCharge: charge,
      total,
    },
  });
}));

// Networks & packages
router.get('/networks', asyncHandler(async (_req, res) => {
  const networks = await Package.distinct('network', { isEnabled: true });
  res.json({ success: true, data: networks });
}));

router.get('/packages', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { isEnabled: true };
  if (req.query.network) filter.network = req.query.network;
  const packages = await Package.find(filter).sort({ sortOrder: 1 });
  res.json({ success: true, data: packages });
}));

// Single purchase
router.post('/purchase', asyncHandler(async (req: AuthRequest, res) => {
  const { packageId, recipientPhone } = req.body;
  if (!packageId || !recipientPhone) throw new AppError('Package and recipient phone required');

  const order = await createOrder({
    packageId,
    recipientPhone,
    dealerId: req.user!._id.toString(),
    source: 'dealer',
  });

  res.status(201).json({ success: true, data: order });
}));

// Bulk purchase - validate
router.post('/bulk/validate', asyncHandler(async (req: AuthRequest, res) => {
  const { lines, network } = req.body;
  if (!lines || !network) throw new AppError('Lines and network required');

  const parsedLines = (lines as string)
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean)
    .map((line: string) => {
      const [phone, bundle] = line.split(/\s+/);
      return { phone, bundleSize: bundle };
    });

  const result = await validateBulkOrders(parsedLines, network, req.user!._id.toString());
  res.json({ success: true, data: result });
}));

// Bulk purchase - confirm
router.post('/bulk/purchase', asyncHandler(async (req: AuthRequest, res) => {
  const { validated } = req.body;
  if (!validated?.length) throw new AppError('No validated orders provided');

  const orders = await processBulkOrders(validated, req.user!._id.toString());
  res.status(201).json({ success: true, data: orders });
}));

// Orders
router.get('/orders', asyncHandler(async (req: AuthRequest, res) => {
  const orders = await Order.find({ dealerId: req.user!._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: orders });
}));

router.get('/orders/:orderId', asyncHandler(async (req: AuthRequest, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId, dealerId: req.user!._id });
  if (!order) throw new AppError('Order not found');
  res.json({ success: true, data: order });
}));

// API credentials
router.get('/api/credentials', asyncHandler(async (req: AuthRequest, res) => {
  const dealer = await User.findById(req.user!._id);
  res.json({
    success: true,
    data: {
      apiKey: dealer?.dealerApi?.apiKey,
      secretKey: dealer?.dealerApi?.secretKey,
      isActive: dealer?.dealerApi?.isActive,
      ipWhitelist: dealer?.dealerApi?.ipWhitelist,
      webhookUrl: dealer?.dealerApi?.webhookUrl,
    },
  });
}));

router.put('/api/settings', asyncHandler(async (req: AuthRequest, res) => {
  const dealer = await User.findById(req.user!._id);
  if (!dealer?.dealerApi) throw new AppError('API not configured');

  if (req.body.ipWhitelist) dealer.dealerApi.ipWhitelist = req.body.ipWhitelist;
  if (req.body.webhookUrl !== undefined) dealer.dealerApi.webhookUrl = req.body.webhookUrl;
  await dealer.save();

  res.json({ success: true, data: dealer.dealerApi });
}));

router.post('/api/regenerate', asyncHandler(async (req: AuthRequest, res) => {
  const dealer = await User.findById(req.user!._id);
  if (!dealer?.dealerApi) throw new AppError('API not configured');

  const { generateApiKey, generateSecretKey } = await import('../utils/helpers');
  dealer.dealerApi.apiKey = generateApiKey();
  dealer.dealerApi.secretKey = generateSecretKey();
  await dealer.save();

  res.json({ success: true, data: { apiKey: dealer.dealerApi.apiKey, secretKey: dealer.dealerApi.secretKey } });
}));

// API logs & stats
router.get('/api/logs', asyncHandler(async (req: AuthRequest, res) => {
  const logs = await ApiLog.find({ dealerId: req.user!._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: logs });
}));

router.get('/api/stats', asyncHandler(async (req: AuthRequest, res) => {
  const stats = await ApiLog.aggregate([
    { $match: { dealerId: req.user!._id } },
    {
      $group: {
        _id: '$endpoint',
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTime' },
      },
    },
  ]);
  res.json({ success: true, data: stats });
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
