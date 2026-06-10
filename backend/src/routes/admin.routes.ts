import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { Package } from '../models/Package';
import { Order } from '../models/Order';
import { Withdrawal } from '../models/Withdrawal';
import { Complaint } from '../models/Complaint';
import { Faq } from '../models/Faq';
import { Wallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { AuditLog } from '../models/AuditLog';
import { Setting } from '../models/Setting';
import { getDateRanges } from '../utils/helpers';
import { createDealerWithWallet, ensureNetworkPackages } from '../services/seedService';
import {
  getSettings,
  depositWithdrawalPool,
  validatePackagePrices,
} from '../services/settingsService';
import { createNotification } from '../services/notificationService';
import {
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  parseWithdrawalAmount,
} from '../services/withdrawalService';
import { upload } from '../middleware/upload';
import { validatePasswordStrength } from '../utils/password';
import { notifyDealerWebhook } from '../services/dealerWebhookService';
import { env } from '../config/env';
import { initPoolDepositPayment } from '../services/paystackPaymentService';
import { sendWithdrawalViaPaystack } from '../services/paystackPayoutService';

const router = Router();
router.use(authenticate, authorize('admin'));

const logAudit = async (req: AuthRequest, action: string, entity: string, entityId?: string, details?: Record<string, unknown>) => {
  await AuditLog.create({
    userId: req.user?._id,
    action,
    entity,
    entityId,
    details,
    ip: req.ip,
  });
};

// Dashboard stats
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const { startOfToday, startOfWeek, startOfMonth } = getDateRanges();

    const [
      totalDealers,
      totalResellers,
      activeStores,
      ordersToday,
      ordersWeek,
      ordersMonth,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      failedOrders,
      revenueAgg,
      profitAgg,
      pendingComplaints,
      pendingWithdrawals,
      walletDeposits,
    ] = await Promise.all([
      User.countDocuments({ role: 'dealer' }),
      User.countDocuments({ role: 'reseller' }),
      User.countDocuments({ role: 'reseller', 'resellerStore.isActive': true }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.countDocuments({ status: 'failed' }),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$profit' } } }]),
      Complaint.countDocuments({ status: 'pending' }),
      Withdrawal.countDocuments({ status: 'pending' }),
      WalletTransaction.aggregate([
        { $match: { type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalDealers,
        totalResellers,
        activeResellerStores: activeStores,
        ordersToday,
        ordersThisWeek: ordersWeek,
        ordersThisMonth: ordersMonth,
        pendingOrders,
        processingOrders,
        deliveredOrders,
        cancelledOrders,
        failedOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalProfit: profitAgg[0]?.total || 0,
        pendingComplaints,
        pendingWithdrawals,
        walletDeposits: walletDeposits[0]?.total || 0,
      },
    });
  })
);

// Dealer management
router.get('/dealers', asyncHandler(async (_req, res) => {
  const dealers = await User.find({ role: 'dealer' }).select('-password').sort({ createdAt: -1 });
  res.json({ success: true, data: dealers });
}));

router.post('/dealers', asyncHandler(async (req: AuthRequest, res) => {
  const { fullName, email, phone, password, status } = req.body;
  if (!fullName || !email || !phone || !password) throw new AppError('All fields required');
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new AppError(passwordError);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('Email already exists');

  const dealer = await createDealerWithWallet({ fullName, email, phone, password });
  if (status) dealer.status = status;
  await dealer.save();

  await logAudit(req, 'create', 'dealer', dealer._id.toString());
  res.status(201).json({ success: true, data: dealer });
}));

router.put('/dealers/:id', asyncHandler(async (req: AuthRequest, res) => {
  const dealer = await User.findOne({ _id: req.params.id, role: 'dealer' });
  if (!dealer) throw new AppError('Dealer not found');

  const { fullName, email, phone, status } = req.body;
  if (fullName) dealer.fullName = fullName;
  if (email) dealer.email = email.toLowerCase();
  if (phone) dealer.phone = phone;
  if (status) dealer.status = status;
  await dealer.save();

  await logAudit(req, 'update', 'dealer', dealer._id.toString());
  res.json({ success: true, data: dealer });
}));

router.delete('/dealers/:id', asyncHandler(async (req: AuthRequest, res) => {
  await User.deleteOne({ _id: req.params.id, role: 'dealer' });
  await logAudit(req, 'delete', 'dealer', req.params.id as string);
  res.json({ success: true, message: 'Dealer deleted' });
}));

router.post('/dealers/:id/reset-password', asyncHandler(async (req: AuthRequest, res) => {
  const { password } = req.body;
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new AppError(passwordError);

  const dealer = await User.findOne({ _id: req.params.id, role: 'dealer' });
  if (!dealer) throw new AppError('Dealer not found');

  dealer.password = await bcrypt.hash(password, 12);
  await dealer.save();
  await logAudit(req, 'reset_password', 'dealer', dealer._id.toString());
  res.json({ success: true, message: 'Password reset successful' });
}));

router.get('/dealers/:id/activity', asyncHandler(async (req, res) => {
  const [orders, transactions] = await Promise.all([
    Order.find({ dealerId: req.params.id }).sort({ createdAt: -1 }).limit(50),
    WalletTransaction.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50),
  ]);
  res.json({ success: true, data: { orders, transactions } });
}));

// Package management
router.get('/packages', asyncHandler(async (_req, res) => {
  const packages = await Package.find().sort({ network: 1, sortOrder: 1 });
  res.json({ success: true, data: packages });
}));

router.post('/packages/seed', asyncHandler(async (req: AuthRequest, res) => {
  await ensureNetworkPackages();
  const packages = await Package.find().sort({ network: 1, sortOrder: 1 });
  await logAudit(req, 'seed', 'package');
  res.json({ success: true, data: packages, message: 'Packages loaded' });
}));

router.post('/packages', asyncHandler(async (req: AuthRequest, res) => {
  const pkg = await Package.create(req.body);
  await logAudit(req, 'create', 'package', pkg._id.toString());
  res.status(201).json({ success: true, data: pkg });
}));

router.put('/packages/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { costPrice, dealerPrice, resellerBasePrice, maxSellingPrice, ...rest } = req.body;
  const priceUpdate: Record<string, number> = {};
  if (costPrice !== undefined) priceUpdate.costPrice = Number(costPrice);
  if (dealerPrice !== undefined) priceUpdate.dealerPrice = Number(dealerPrice);
  if (resellerBasePrice !== undefined) priceUpdate.resellerBasePrice = Number(resellerBasePrice);
  if (maxSellingPrice !== undefined) priceUpdate.maxSellingPrice = Number(maxSellingPrice);

  const existing = await Package.findById(req.params.id);
  if (!existing) throw new AppError('Package not found');

  validatePackagePrices({
    costPrice: priceUpdate.costPrice ?? existing.costPrice,
    dealerPrice: priceUpdate.dealerPrice ?? existing.dealerPrice,
    resellerBasePrice: priceUpdate.resellerBasePrice ?? existing.resellerBasePrice,
    maxSellingPrice: priceUpdate.maxSellingPrice ?? existing.maxSellingPrice,
  });

  const pkg = await Package.findByIdAndUpdate(
    req.params.id,
    { ...rest, ...priceUpdate },
    { new: true }
  );
  if (!pkg) throw new AppError('Package not found');
  await logAudit(req, 'update', 'package', pkg._id.toString(), priceUpdate);
  res.json({ success: true, data: pkg });
}));

router.patch('/packages/:id/prices', asyncHandler(async (req: AuthRequest, res) => {
  const { dealerPrice, resellerBasePrice, maxSellingPrice } = req.body;
  const existing = await Package.findById(req.params.id);
  if (!existing) throw new AppError('Package not found');

  const updates: Record<string, number> = {};
  if (dealerPrice !== undefined) updates.dealerPrice = Number(dealerPrice);
  if (resellerBasePrice !== undefined) updates.resellerBasePrice = Number(resellerBasePrice);
  if (maxSellingPrice !== undefined) updates.maxSellingPrice = Number(maxSellingPrice);

  validatePackagePrices({
    costPrice: existing.costPrice,
    dealerPrice: updates.dealerPrice ?? existing.dealerPrice,
    resellerBasePrice: updates.resellerBasePrice ?? existing.resellerBasePrice,
    maxSellingPrice: updates.maxSellingPrice ?? existing.maxSellingPrice,
  });

  Object.assign(existing, updates);
  await existing.save();
  await logAudit(req, 'update_prices', 'package', existing._id.toString(), updates);
  res.json({ success: true, data: existing, message: 'Prices updated for all dealers and resellers' });
}));

router.delete('/packages/:id', asyncHandler(async (req: AuthRequest, res) => {
  await Package.findByIdAndDelete(req.params.id);
  await logAudit(req, 'delete', 'package', req.params.id as string);
  res.json({ success: true, message: 'Package deleted' });
}));

router.patch('/packages/:id/toggle', asyncHandler(async (req: AuthRequest, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) throw new AppError('Package not found');
  pkg.isEnabled = !pkg.isEnabled;
  await pkg.save();
  res.json({ success: true, data: pkg });
}));

// Resellers
router.get('/resellers', asyncHandler(async (_req, res) => {
  const resellers = await User.find({ role: 'reseller' }).select('-password').sort({ createdAt: -1 });
  const wallets = await Wallet.find({ userId: { $in: resellers.map((r) => r._id) } });
  const walletMap = new Map(wallets.map((w) => [w.userId.toString(), w]));

  const data = resellers.map((r) => {
    const wallet = walletMap.get(r._id.toString());
    return {
      ...r.toObject(),
      profitBalance: wallet?.profitBalance ?? 0,
      totalWithdrawals: wallet?.totalWithdrawals ?? 0,
    };
  });

  res.json({ success: true, data });
}));

router.patch('/resellers/:id/toggle', asyncHandler(async (req: AuthRequest, res) => {
  const reseller = await User.findOne({ _id: req.params.id, role: 'reseller' });
  if (!reseller?.resellerStore) throw new AppError('Reseller not found');
  reseller.resellerStore.isActive = !reseller.resellerStore.isActive;
  await reseller.save();
  res.json({ success: true, data: reseller });
}));

router.patch('/resellers/:id/complaint-access', asyncHandler(async (req: AuthRequest, res) => {
  const { complaintEnabled } = req.body;
  if (typeof complaintEnabled !== 'boolean') {
    throw new AppError('complaintEnabled must be true or false');
  }

  const reseller = await User.findOne({ _id: req.params.id, role: 'reseller' });
  if (!reseller) throw new AppError('Reseller not found');

  reseller.complaintEnabled = complaintEnabled;
  await reseller.save();

  const settings = await getSettings();
  settings.complaintSettings.userOverrides.set(reseller._id.toString(), complaintEnabled);
  settings.markModified('complaintSettings.userOverrides');
  await settings.save();

  res.json({
    success: true,
    message: complaintEnabled ? 'Complaints enabled for reseller' : 'Complaints disabled for reseller',
    data: { id: reseller._id, complaintEnabled: reseller.complaintEnabled },
  });
}));

// Orders (all dealer + reseller store orders)
router.get('/orders', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, source } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (source) filter.source = source;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('dealerId', 'fullName email')
      .populate('resellerId', 'fullName email resellerStore.storeName')
      .select(
        'orderId customerEmail recipientPhone network bundleSize status source sellingPrice profit totalAmount dealerId resellerId createdAt updatedAt'
      )
      .lean(),
    Order.countDocuments(filter),
  ]);

  const data = orders.map((o) => {
    const dealer = o.dealerId as { _id?: unknown; fullName?: string; email?: string } | null;
    const reseller = o.resellerId as {
      _id?: unknown;
      fullName?: string;
      email?: string;
      resellerStore?: { storeName?: string };
    } | null;
    const dealerIsDoc = dealer && typeof dealer === 'object' && 'fullName' in dealer;
    const resellerIsDoc = reseller && typeof reseller === 'object' && 'fullName' in reseller;
    return {
      ...o,
      dealerId: dealerIsDoc ? dealer._id : o.dealerId,
      resellerId: resellerIsDoc ? reseller._id : o.resellerId,
      dealerName: dealerIsDoc ? dealer.fullName : undefined,
      dealerEmail: dealerIsDoc ? dealer.email : undefined,
      resellerName: resellerIsDoc ? reseller.fullName : undefined,
      resellerEmail: resellerIsDoc ? reseller.email : undefined,
      storeName: resellerIsDoc ? reseller.resellerStore?.storeName : undefined,
    };
  });

  res.json({ success: true, data: { orders: data, total, page: Number(page) } });
}));

router.patch('/orders/:orderId/status', asyncHandler(async (req: AuthRequest, res) => {
  const allowed = ['pending', 'processing', 'delivered', 'failed', 'refunded', 'cancelled'];
  const { status } = req.body;
  if (!allowed.includes(status)) throw new AppError('Invalid order status');

  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) throw new AppError('Order not found');
  order.status = status;
  await order.save();
  await notifyDealerWebhook(order);
  res.json({ success: true, data: order });
}));

// Withdrawals
router.get('/withdrawals', asyncHandler(async (_req, res) => {
  const withdrawals = await Withdrawal.find().populate('userId', 'fullName email').sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
}));

router.patch('/withdrawals/:id', asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.amount !== undefined) {
    throw new AppError('Withdrawal amount cannot be changed');
  }

  const { status, adminNote } = req.body;
  const allowed = ['approved', 'paid', 'rejected'];
  if (status && !allowed.includes(status)) {
    throw new AppError('Invalid withdrawal status');
  }

  let withdrawal;
  if (status === 'approved') {
    withdrawal = await approveWithdrawal(req.params.id as string);
    try {
      const payout = await sendWithdrawalViaPaystack(withdrawal);
      withdrawal.paystackTransferCode = payout.transferCode;
      withdrawal.paystackTransferReference = payout.transferReference;
      withdrawal.paystackTransferStatus = payout.transferStatus;
      withdrawal.adminNote = [
        withdrawal.adminNote,
        `Paystack transfer initiated (${payout.transferReference})`,
      ].filter(Boolean).join(' | ');
      await withdrawal.save();
    } catch (payoutErr) {
      const msg = payoutErr instanceof Error ? payoutErr.message : 'Paystack payout failed';
      withdrawal.adminNote = [
        withdrawal.adminNote,
        `Paystack payout pending: ${msg}. Mark paid manually after MoMo transfer.`,
      ].filter(Boolean).join(' | ');
      await withdrawal.save();
    }
    await createNotification(
      withdrawal.userId,
      'withdrawal_approved',
      'Withdrawal Approved',
      `Your withdrawal of GHS ${withdrawal.amount} has been approved and will be sent to your MoMo.`
    );
  } else if (status === 'paid') {
    withdrawal = await markWithdrawalPaid(req.params.id as string);
    await createNotification(
      withdrawal.userId,
      'withdrawal_paid',
      'Withdrawal Paid',
      `Your withdrawal of GHS ${withdrawal.amount} has been paid.`
    );
  } else if (status === 'rejected') {
    withdrawal = await rejectWithdrawal(req.params.id as string, adminNote);
    await createNotification(
      withdrawal.userId,
      'withdrawal_rejected',
      'Withdrawal Rejected',
      adminNote || `Your withdrawal request of GHS ${withdrawal.amount} was rejected.`
    );
  } else {
    throw new AppError('Status update required');
  }

  if (adminNote && status !== 'rejected') {
    withdrawal.adminNote = adminNote;
    await withdrawal.save();
  }

  await logAudit(req, 'update', 'withdrawal', withdrawal._id.toString(), { status: withdrawal.status });
  res.json({ success: true, data: withdrawal });
}));

// Complaints
router.get('/complaints', asyncHandler(async (_req, res) => {
  const complaints = await Complaint.find()
    .populate('userId', 'fullName email complaintEnabled resellerStore.storeName')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: complaints });
}));

router.patch('/complaints/:id', asyncHandler(async (req: AuthRequest, res) => {
  const allowed = ['pending', 'under_review', 'resolved', 'rejected', 'refunded'];
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found');

  if (req.body.status) {
    if (!allowed.includes(req.body.status)) throw new AppError('Invalid complaint status');
    complaint.status = req.body.status;
  }
  if (req.body.adminResponse) complaint.adminResponse = req.body.adminResponse;
  await complaint.save();

  await createNotification(
    complaint.userId,
    'complaint_updated',
    'Complaint Updated',
    `Your complaint for order ${complaint.orderId} is now ${complaint.status}.`
  );

  res.json({ success: true, data: complaint });
}));

// Platform settings
router.get('/settings', asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  const pendingWithdrawalTotal = await Withdrawal.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalResellerProfit = await Wallet.aggregate([
    { $group: { _id: null, total: { $sum: '$profitBalance' } } },
  ]);

  res.json({
    success: true,
    data: {
      processingFeePercent: settings.processingFeePercent,
      paystackChargePercent: settings.paystackChargePercent,
      minWithdrawal: settings.minWithdrawal,
      withdrawalPoolBalance: settings.withdrawalPoolBalance || 0,
      totalPoolDeposits: settings.totalPoolDeposits || 0,
      pendingWithdrawalTotal: pendingWithdrawalTotal[0]?.total || 0,
      totalResellerProfit: totalResellerProfit[0]?.total || 0,
    },
  });
}));

router.put('/settings', asyncHandler(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  const { processingFeePercent, paystackChargePercent, minWithdrawal } = req.body;

  if (processingFeePercent !== undefined) {
    const fee = Number(processingFeePercent);
    if (fee < 0 || fee > 100) throw new AppError('Processing fee must be between 0 and 100');
    settings.processingFeePercent = fee;
  }
  if (paystackChargePercent !== undefined) {
    const fee = Number(paystackChargePercent);
    if (fee < 0 || fee > 100) throw new AppError('Paystack charge must be between 0 and 100');
    settings.paystackChargePercent = fee;
  }
  if (minWithdrawal !== undefined) {
    const min = Number(minWithdrawal);
    if (min < 1) throw new AppError('Minimum withdrawal must be at least GHS 1');
    settings.minWithdrawal = min;
  }

  await settings.save();
  await logAudit(req, 'update', 'settings');
  res.json({ success: true, data: settings });
}));

// Fund withdrawal pool via Paystack (card / MoMo)
router.post('/settings/withdrawal-pool/fund', asyncHandler(async (req: AuthRequest, res) => {
  const amount = parseWithdrawalAmount(req.body.amount);
  const { note } = req.body;

  const data = await initPoolDepositPayment(
    req.user!.email,
    req.user!._id.toString(),
    amount,
    note
  );

  res.json({
    success: true,
    message: 'Redirect to Paystack to fund the withdrawal pool',
    data,
  });
}));

// Manual pool deposit (bank transfer / cash already received)
router.post('/settings/withdrawal-pool/deposit', asyncHandler(async (req: AuthRequest, res) => {
  const amount = parseWithdrawalAmount(req.body.amount);
  const { note } = req.body;
  const result = await depositWithdrawalPool(amount, note);
  await logAudit(req, 'deposit', 'withdrawal_pool', undefined, {
    amount: result.amount,
    note,
    balanceAfter: result.settings.withdrawalPoolBalance,
    source: 'manual',
  });
  res.json({
    success: true,
    message: `GHS ${result.amount} added to withdrawal pool`,
    data: {
      withdrawalPoolBalance: result.settings.withdrawalPoolBalance,
      totalPoolDeposits: result.settings.totalPoolDeposits,
    },
  });
}));

// Complaint settings
router.get('/settings/complaints', asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, data: settings.complaintSettings });
}));

router.put('/settings/complaints', asyncHandler(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  if (typeof req.body.globalEnabled === 'boolean') {
    settings.complaintSettings.globalEnabled = req.body.globalEnabled;
  }
  if (req.body.activeNotice !== undefined) {
    settings.complaintSettings.activeNotice = req.body.activeNotice;
  }
  await settings.save();
  res.json({ success: true, data: settings.complaintSettings });
}));

// Service images
router.put('/settings/service-images', upload.single('image'), asyncHandler(async (req: AuthRequest, res) => {
  const { network } = req.body;
  const settings = await getSettings();
  const imageUrl = req.file ? `/${env.uploadDir}/${req.file.filename}` : req.body.imageUrl;

  const idx = settings.serviceImages.findIndex((s) => s.network === network);
  if (idx >= 0) {
    settings.serviceImages[idx].imageUrl = imageUrl;
    if (req.body.isAvailable !== undefined) {
      settings.serviceImages[idx].isAvailable = req.body.isAvailable === 'true';
    }
  } else {
    settings.serviceImages.push({ network, imageUrl, isAvailable: true });
  }
  await settings.save();
  res.json({ success: true, data: settings.serviceImages });
}));

// FAQs
router.get('/faqs', asyncHandler(async (_req, res) => {
  const faqs = await Faq.find().sort({ sortOrder: 1 });
  res.json({ success: true, data: faqs });
}));

router.post('/faqs', asyncHandler(async (req, res) => {
  const faq = await Faq.create(req.body);
  res.status(201).json({ success: true, data: faq });
}));

router.put('/faqs/:id', asyncHandler(async (req, res) => {
  const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: faq });
}));

router.delete('/faqs/:id', asyncHandler(async (req, res) => {
  await Faq.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'FAQ deleted' });
}));

// Reports export (CSV)
router.get('/reports/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = [];
  let headers: string[] = [];

  switch (type) {
    case 'orders': {
      const rawOrders = await Order.find()
        .sort({ createdAt: -1 })
        .populate('dealerId', 'fullName email')
        .populate('resellerId', 'fullName email resellerStore.storeName')
        .lean();
      headers = [
        'orderId',
        'source',
        'status',
        'network',
        'bundleSize',
        'recipientPhone',
        'customerEmail',
        'dealerName',
        'dealerEmail',
        'resellerName',
        'resellerEmail',
        'storeName',
        'sellingPrice',
        'profit',
        'totalAmount',
        'createdAt',
      ];
      data = rawOrders.map((o) => {
        const dealer = o.dealerId as { fullName?: string; email?: string } | null;
        const reseller = o.resellerId as {
          fullName?: string;
          email?: string;
          resellerStore?: { storeName?: string };
        } | null;
        return {
          orderId: o.orderId,
          source: o.source,
          status: o.status,
          network: o.network,
          bundleSize: o.bundleSize,
          recipientPhone: o.recipientPhone,
          customerEmail: o.customerEmail ?? '',
          dealerName: dealer?.fullName ?? '',
          dealerEmail: dealer?.email ?? '',
          resellerName: reseller?.fullName ?? '',
          resellerEmail: reseller?.email ?? '',
          storeName: reseller?.resellerStore?.storeName ?? '',
          sellingPrice: o.sellingPrice,
          profit: o.profit,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
        };
      });
      break;
    }
    case 'withdrawals':
      data = await Withdrawal.find().lean();
      headers = ['amount', 'network', 'mobileNumber', 'status', 'createdAt'];
      break;
    case 'complaints':
      data = await Complaint.find().lean();
      headers = ['orderId', 'issueType', 'status', 'createdAt'];
      break;
    case 'dealers':
      data = await User.find({ role: 'dealer' }).select('-password').lean();
      headers = ['fullName', 'email', 'phone', 'status', 'createdAt'];
      break;
    case 'resellers':
      data = await User.find({ role: 'reseller' }).select('-password').lean();
      headers = ['fullName', 'email', 'phone', 'status', 'createdAt'];
      break;
    default:
      throw new AppError('Invalid report type');
  }

  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
  res.send(csv);
}));

export default router;
