import { User } from '../models/User';
import { Order } from '../models/Order';
import { Complaint } from '../models/Complaint';
import { Withdrawal } from '../models/Withdrawal';
import { WalletTransaction } from '../models/WalletTransaction';
import { getDateRanges } from '../utils/helpers';
import { getOrderGrowthChart } from './growthChartService';
import { getPlatformProfitTotals } from './platformProfitService';
import { getPerformanceLeaderboard } from './performanceService';
import { getResellerPoolSummary } from './resellerProfitService';
import { getFulfillmentStatusCounts } from './fulfillmentProviderService';

const CACHE_TTL_MS = 45_000;
let cache: { expires: number; data: Record<string, unknown> } | null = null;

function mapRecentOrder(o: Record<string, unknown>) {
  const dealer = o.agentId as { fullName?: string } | null;
  const reseller = o.resellerId as {
    fullName?: string;
    resellerStore?: { storeName?: string };
  } | null;
  const dealerIsDoc = dealer && typeof dealer === 'object' && 'fullName' in dealer;
  const resellerIsDoc = reseller && typeof reseller === 'object' && 'fullName' in reseller;
  return {
    _id: String(o._id),
    orderId: o.orderId,
    recipientPhone: o.recipientPhone,
    network: o.network,
    bundleSize: o.bundleSize,
    status: o.status,
    providerStatus: o.providerStatus,
    source: o.source,
    sellingPrice: o.sellingPrice,
    AgentName: dealerIsDoc ? dealer.fullName : undefined,
    resellerName: resellerIsDoc ? reseller.fullName : undefined,
    storeName: resellerIsDoc ? reseller.resellerStore?.storeName : undefined,
    createdAt: o.createdAt,
  };
}

async function getOrderStats() {
  const { startOfToday, startOfWeek, startOfMonth } = getDateRanges();
  const [facet] = await Order.aggregate([
    {
      $facet: {
        ordersToday: [{ $match: { createdAt: { $gte: startOfToday } } }, { $count: 'n' }],
        ordersWeek: [{ $match: { createdAt: { $gte: startOfWeek } } }, { $count: 'n' }],
        ordersMonth: [{ $match: { createdAt: { $gte: startOfMonth } } }, { $count: 'n' }],
        pending: [{ $match: { status: 'pending' } }, { $count: 'n' }],
        processing: [{ $match: { status: 'processing' } }, { $count: 'n' }],
        delivered: [{ $match: { status: 'delivered' } }, { $count: 'n' }],
        cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'n' }],
        failed: [{ $match: { status: 'failed' } }, { $count: 'n' }],
        revenue: [{ $group: { _id: null, total: { $sum: '$totalAmount' } } }],
      },
    },
  ]);

  const pick = (key: string) => facet?.[key]?.[0]?.n ?? facet?.[key]?.[0]?.total ?? 0;
  return {
    ordersToday: pick('ordersToday'),
    ordersThisWeek: pick('ordersWeek'),
    ordersThisMonth: pick('ordersMonth'),
    pendingOrders: pick('pending'),
    processingOrders: pick('processing'),
    deliveredOrders: pick('delivered'),
    cancelledOrders: pick('cancelled'),
    failedOrders: pick('failed'),
    totalRevenue: pick('revenue'),
  };
}

export async function getAdminDashboardStats(forceRefresh = false) {
  if (!forceRefresh && cache && cache.expires > Date.now()) {
    return cache.data;
  }

  const [
    userCounts,
    orderStats,
    platformProfit,
    fulfillmentCounts,
    topAgents,
    topResellers,
    pendingComplaints,
    pendingWithdrawals,
    walletDeposits,
    growthChart,
    poolSummary,
    recentOrders,
    recentComplaints,
  ] = await Promise.all([
    Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'reseller' }),
      User.countDocuments({ role: 'reseller', 'resellerStore.isActive': true }),
    ]),
    getOrderStats(),
    getPlatformProfitTotals(),
    getFulfillmentStatusCounts(),
    getPerformanceLeaderboard('agent', 5),
    getPerformanceLeaderboard('reseller', 5),
    Complaint.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    Withdrawal.countDocuments({ status: 'pending' }),
    WalletTransaction.aggregate([
      { $match: { type: 'deposit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    getOrderGrowthChart({}, 14, 'totalAmount'),
    getResellerPoolSummary(),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('agentId', 'fullName')
      .populate('resellerId', 'fullName resellerStore.storeName')
      .select(
        'orderId recipientPhone network bundleSize status providerStatus source sellingPrice agentId resellerId createdAt'
      )
      .lean(),
    Complaint.find({ status: { $in: ['pending', 'under_review'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullName')
      .select('orderId phoneNumber status createdAt userId')
      .lean(),
  ]);

  const [totalAgents, totalResellers, activeStores] = userCounts;

  const data = {
    totalAgents,
    totalDealers: totalAgents,
    totalResellers,
    activeResellerStores: activeStores,
    ...orderStats,
    ...platformProfit,
    topPerformers: { agents: topAgents, dealers: topAgents, resellers: topResellers },
    pendingComplaints,
    pendingWithdrawals,
    walletDeposits: walletDeposits[0]?.total || 0,
    ...poolSummary,
    growthChart,
    ...fulfillmentCounts,
    recentOrders: recentOrders.map((o) => mapRecentOrder(o as unknown as Record<string, unknown>)),
    recentComplaints,
  };

  cache = { expires: Date.now() + CACHE_TTL_MS, data };
  return data;
}

export function invalidateAdminDashboardCache() {
  cache = null;
}
