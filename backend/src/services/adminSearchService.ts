import { User } from '../models/User';
import { Order } from '../models/Order';
import { Wallet } from '../models/Wallet';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildOrderSearchFilter(query: string): Record<string, unknown> | null {
  const q = query.trim();
  if (q.length < 2) return null;

  const regex = new RegExp(escapeRegex(q), 'i');
  const phoneDigits = q.replace(/\D/g, '');
  const or: Record<string, unknown>[] = [
    { orderId: regex },
    { customerEmail: regex },
    { paystackReference: regex },
    { providerReference: regex },
  ];
  if (phoneDigits.length >= 4) {
    or.push({ recipientPhone: new RegExp(phoneDigits) });
  }
  return { $or: or };
}

export async function adminSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) {
    return { query: q, resellers: [], orders: [] };
  }

  const regex = new RegExp(escapeRegex(q), 'i');
  const phoneDigits = q.replace(/\D/g, '');

  const resellerOr: Record<string, unknown>[] = [
    { fullName: regex },
    { email: regex },
    { phone: regex },
    { 'resellerStore.storeName': regex },
    { 'resellerStore.slug': regex },
  ];
  if (phoneDigits.length >= 4) {
    resellerOr.push({ phone: new RegExp(phoneDigits) });
  }

  const orderOr: Record<string, unknown>[] = [
    { orderId: regex },
    { customerEmail: regex },
    { paystackReference: regex },
    { providerReference: regex },
  ];
  if (phoneDigits.length >= 4) {
    orderOr.push({ recipientPhone: new RegExp(phoneDigits) });
  }

  const [resellerDocs, orderDocs] = await Promise.all([
    User.find({ role: 'reseller', $or: resellerOr })
      .select('fullName email phone status complaintEnabled resellerStore')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Order.find({ $or: orderOr })
      .sort({ createdAt: -1 })
      .limit(40)
      .populate('agentId', 'fullName email')
      .populate('resellerId', 'fullName email resellerStore.storeName')
      .select(
        'orderId customerEmail recipientPhone network bundleSize status providerStatus source sellingPrice profit totalAmount agentId resellerId createdAt'
      )
      .lean(),
  ]);

  const wallets = await Wallet.find({
    userId: { $in: resellerDocs.map((r) => r._id) },
  }).lean();
  const walletMap = new Map(wallets.map((w) => [w.userId.toString(), w]));

  const resellers = resellerDocs.map((r) => {
    const wallet = walletMap.get(r._id.toString());
    return {
      _id: r._id,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      status: r.status,
      complaintEnabled: r.complaintEnabled,
      storeName: r.resellerStore?.storeName,
      storeSlug: r.resellerStore?.slug,
      storeActive: r.resellerStore?.isActive !== false,
      profitBalance: wallet?.profitBalance ?? 0,
    };
  });

  const orders = orderDocs.map((o) => {
    const dealer = o.agentId as { _id?: unknown; fullName?: string } | null;
    const reseller = o.resellerId as {
      _id?: unknown;
      fullName?: string;
      resellerStore?: { storeName?: string };
    } | null;
    const dealerIsDoc = dealer && typeof dealer === 'object' && 'fullName' in dealer;
    const resellerIsDoc = reseller && typeof reseller === 'object' && 'fullName' in reseller;
    return {
      _id: o._id,
      orderId: o.orderId,
      customerEmail: o.customerEmail,
      recipientPhone: o.recipientPhone,
      network: o.network,
      bundleSize: o.bundleSize,
      status: o.status,
      providerStatus: o.providerStatus,
      source: o.source,
      sellingPrice: o.sellingPrice,
      profit: o.profit,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      dealerName: dealerIsDoc ? dealer.fullName : undefined,
      resellerName: resellerIsDoc ? reseller.fullName : undefined,
      storeName: resellerIsDoc ? reseller.resellerStore?.storeName : undefined,
    };
  });

  return { query: q, resellers, orders };
}
