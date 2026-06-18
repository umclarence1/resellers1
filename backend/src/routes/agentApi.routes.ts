import { Router } from 'express';
import { agentApiAuth, AgentApiRequest } from '../middleware/agentApiAuth';
import { apiLimiter } from '../middleware/rateLimiter';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { Package } from '../models/Package';
import { Order } from '../models/Order';
import { getOrCreateWallet } from '../services/walletService';
import { createOrder, validateBulkOrders, processBulkOrders } from '../services/orderService';
import { getNetworkStockList } from '../services/networkStockService';
import { getAfaStock } from '../services/afaStockService';
import { getAfaPackage } from '../services/afaPackageService';
import { AFA_CHECK_USSD, AFA_PROCESSING_HOURS } from '../config/afa';
import { getAgentPrice } from '../services/agentPricingService';

const router = Router();
router.use(apiLimiter, agentApiAuth);

// Wallet balance
router.get('/wallet', asyncHandler(async (req: AgentApiRequest, res) => {
  const wallet = await getOrCreateWallet(req.user!._id);
  res.json({ success: true, data: { balance: wallet.balance } });
}));

// Networks
router.get('/networks', asyncHandler(async (_req, res) => {
  const stock = await getNetworkStockList();
  res.json({ success: true, data: stock });
}));

// Packages
router.get('/packages', asyncHandler(async (req: AgentApiRequest, res) => {
  const stock = await getNetworkStockList();
  const inStock = new Set(stock.filter((s) => s.inStock).map((s) => s.network));
  const filter: Record<string, unknown> = { isEnabled: true, productType: 'data' };
  if (req.query.network) filter.network = req.query.network;
  const packages = await Package.find(filter).select('network bundleSize agentPrice').sort({ sortOrder: 1 });
  const agentId = req.user!._id;
  const filtered = packages.filter((p) => inStock.has(p.network));
  const data = await Promise.all(
    filtered.map(async (p) => ({
      _id: p._id,
      network: p.network,
      bundleSize: p.bundleSize,
      agentPrice: await getAgentPrice(agentId, p._id, p),
    }))
  );
  res.json({
    success: true,
    data,
  });
}));

// Purchase
router.post('/purchase', asyncHandler(async (req: AgentApiRequest, res) => {
  const { packageId, recipientPhone } = req.body;
  if (!packageId || !recipientPhone) throw new AppError('packageId and recipientPhone required');

  const order = await createOrder({
    packageId,
    recipientPhone,
    agentId: req.user!._id.toString(),
    source: 'agent_api',
  });

  res.status(201).json({ success: true, data: order });
}));

router.get('/afa', asyncHandler(async (req: AgentApiRequest, res) => {
  const [stock, pkg, wallet] = await Promise.all([
    getAfaStock(),
    getAfaPackage(),
    getOrCreateWallet(req.user!._id),
  ]);
  if (!pkg) throw new AppError('AFA registration package is not configured', 503);

  const fee = await getAgentPrice(req.user!._id, pkg._id, pkg);
  res.json({
    success: true,
    data: {
      packageId: pkg._id,
      fee,
      inStock: stock.inStock,
      processingHours: AFA_PROCESSING_HOURS,
      checkUssd: AFA_CHECK_USSD,
      walletBalance: wallet.balance,
    },
  });
}));

router.post('/afa/register', asyncHandler(async (req: AgentApiRequest, res) => {
  const { fullName, phone, ghanaCard, location, occupation } = req.body;
  const pkg = await getAfaPackage();
  if (!pkg) throw new AppError('AFA registration is not available', 503);

  const order = await createOrder({
    packageId: pkg._id.toString(),
    afaDetails: { fullName, phone, ghanaCard, location, occupation },
    agentId: req.user!._id.toString(),
    source: 'agent_api',
  });

  res.status(201).json({
    success: true,
    data: {
      orderId: order.orderId,
      status: order.status,
      message: `Registration submitted. Allow ${AFA_PROCESSING_HOURS} hours, then dial ${AFA_CHECK_USSD} to check status.`,
    },
  });
}));

// Bulk purchase
router.post('/bulk-purchase', asyncHandler(async (req: AgentApiRequest, res) => {
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
  const orders = await processBulkOrders(validated, req.user!._id.toString(), 'agent_api');

  res.status(201).json({ success: true, data: orders });
}));

// Order status
router.get('/orders/:orderId', asyncHandler(async (req: AgentApiRequest, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    agentId: req.user!._id,
  });
  if (!order) throw new AppError('Order not found', 404);
  res.json({ success: true, data: order });
}));

export default router;
