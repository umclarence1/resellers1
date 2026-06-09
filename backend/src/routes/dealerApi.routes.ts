import { Router } from 'express';
import { dealerApiAuth, DealerApiRequest } from '../middleware/dealerApiAuth';
import { apiLimiter } from '../middleware/rateLimiter';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { Package } from '../models/Package';
import { Order } from '../models/Order';
import { getOrCreateWallet } from '../services/walletService';
import { createOrder, validateBulkOrders, processBulkOrders } from '../services/orderService';

const router = Router();
router.use(apiLimiter, dealerApiAuth);

// Wallet balance
router.get('/wallet', asyncHandler(async (req: DealerApiRequest, res) => {
  const wallet = await getOrCreateWallet(req.user!._id);
  res.json({ success: true, data: { balance: wallet.balance } });
}));

// Networks
router.get('/networks', asyncHandler(async (_req, res) => {
  const networks = await Package.distinct('network', { isEnabled: true });
  res.json({ success: true, data: networks });
}));

// Packages
router.get('/packages', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { isEnabled: true };
  if (req.query.network) filter.network = req.query.network;
  const packages = await Package.find(filter).select('network bundleSize dealerPrice').sort({ sortOrder: 1 });
  res.json({ success: true, data: packages });
}));

// Purchase
router.post('/purchase', asyncHandler(async (req: DealerApiRequest, res) => {
  const { packageId, recipientPhone } = req.body;
  if (!packageId || !recipientPhone) throw new AppError('packageId and recipientPhone required');

  const order = await createOrder({
    packageId,
    recipientPhone,
    dealerId: req.user!._id.toString(),
    source: 'dealer_api',
  });

  res.status(201).json({ success: true, data: order });
}));

// Bulk purchase
router.post('/bulk-purchase', asyncHandler(async (req: DealerApiRequest, res) => {
  const { lines, network } = req.body;
  if (!lines || !network) throw new AppError('lines and network required');

  const parsedLines = (lines as string)
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean)
    .map((line: string) => {
      const [phone, bundle] = line.split(/\s+/);
      return { phone, bundleSize: bundle };
    });

  const { validated } = await validateBulkOrders(parsedLines, network, req.user!._id.toString());
  const orders = await processBulkOrders(validated, req.user!._id.toString(), 'dealer_api');

  res.status(201).json({ success: true, data: orders });
}));

// Order status
router.get('/orders/:orderId', asyncHandler(async (req: DealerApiRequest, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    dealerId: req.user!._id,
  });
  if (!order) throw new AppError('Order not found', 404);
  res.json({ success: true, data: order });
}));

export default router;
