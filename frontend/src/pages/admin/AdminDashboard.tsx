import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard, Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { Users, Store, ShoppingCart, DollarSign, MessageSquare, Wallet, ArrowRight, Phone, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { downloadAdminReport } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ComplaintPreview {
  _id: string;
  orderId: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
  userId?: { fullName: string };
}

interface OrderPreview {
  _id: string;
  orderId: string;
  recipientPhone: string;
  network: string;
  bundleSize: string;
  status: string;
  source: string;
  sellingPrice: number;
  dealerName?: string;
  resellerName?: string;
  storeName?: string;
  createdAt: string;
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-sky-100 text-sky-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [poolBalance, setPoolBalance] = useState(0);
  const [recentComplaints, setRecentComplaints] = useState<ComplaintPreview[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderPreview[]>([]);
  const [exportingOrders, setExportingOrders] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/admin/dashboard').then((res) => setStats(res.data.data)).catch(console.error);
      api.get('/admin/settings').then((res) => setPoolBalance(res.data.data.withdrawalPoolBalance || 0)).catch(console.error);
      api.get('/admin/complaints').then((res) => {
        const open = (res.data.data as ComplaintPreview[]).filter(
          (c) => c.status === 'pending' || c.status === 'under_review'
        );
        setRecentComplaints(open.slice(0, 5));
      }).catch(console.error);
      api.get('/admin/orders', { params: { limit: 10 } }).then((res) => {
        setRecentOrders(res.data.data.orders);
      }).catch(console.error);
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Admin Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Dealers" value={stats.totalDealers || 0} icon={<Users className="w-5 h-5" />} color="blue" />
        <StatCard title="Total Resellers" value={stats.totalResellers || 0} icon={<Users className="w-5 h-5" />} color="green" />
        <StatCard title="Active Stores" value={stats.activeResellerStores || 0} icon={<Store className="w-5 h-5" />} color="purple" />
        <Link to="/admin/orders" className="block">
          <StatCard title="Orders Today" value={stats.ordersToday || 0} icon={<ShoppingCart className="w-5 h-5" />} color="orange" />
        </Link>
        <StatCard title="Orders This Week" value={stats.ordersThisWeek || 0} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Orders This Month" value={stats.ordersThisMonth || 0} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} icon={<DollarSign className="w-5 h-5" />} color="green" />
        <StatCard title="Total Profit" value={formatCurrency(stats.totalProfit || 0)} icon={<DollarSign className="w-5 h-5" />} color="blue" />
        <Link to="/admin/complaints" className="block">
          <StatCard title="Pending Complaints" value={stats.pendingComplaints || 0} icon={<MessageSquare className="w-5 h-5" />} color="red" />
        </Link>
        <Link to="/admin/withdrawals" className="block">
          <StatCard title="Pending Withdrawals" value={stats.pendingWithdrawals || 0} icon={<Wallet className="w-5 h-5" />} color="orange" />
        </Link>
        <Link to="/admin/settings" className="block">
          <StatCard title="Withdrawal Pool" value={formatCurrency(poolBalance)} icon={<Wallet className="w-5 h-5" />} color="green" />
        </Link>
        <StatCard title="Wallet Deposits" value={formatCurrency(stats.walletDeposits || 0)} icon={<Wallet className="w-5 h-5" />} />
      </div>

      <Card className="overflow-hidden mb-8">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Recent orders</h2>
            <span className="text-xs text-gray-500">Dealers &amp; resellers</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={exportingOrders}
              onClick={async () => {
                setExportingOrders(true);
                try {
                  await downloadAdminReport('orders');
                } catch (e) {
                  console.error(e);
                } finally {
                  setExportingOrders(false);
                }
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              {exportingOrders ? 'Exporting...' : 'Export all'}
            </Button>
            <Link to="/admin/orders">
              <Button size="sm" variant="outline">
                View all <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        {recentOrders.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">No orders yet</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentOrders.map((o) => (
              <li key={o._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <span className="font-mono text-xs">{o.orderId}</span>
                    {' · '}
                    {o.network} {o.bundleSize} → {o.recipientPhone}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {o.source?.replace('_', ' ')}
                    {' · '}
                    {o.source === 'reseller_store'
                      ? o.storeName || o.resellerName || 'Reseller'
                      : o.dealerName || 'Dealer'}
                    {' · '}
                    {formatCurrency(o.sellingPrice)}
                    {' · '}
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold px-2 py-1 rounded-full capitalize w-fit',
                    ORDER_STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-700'
                  )}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-gray-900">Recent complaints</h2>
          </div>
          <Link to="/admin/complaints">
            <Button size="sm" variant="outline">
              View all <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        {recentComplaints.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">No open complaints</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentComplaints.map((c) => (
              <li key={c._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <Phone className="w-3.5 h-3.5 inline mr-1 text-gold" />
                    {c.phoneNumber} · <span className="font-mono text-xs">{c.orderId}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    From {c.userId?.fullName || 'Reseller'} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full capitalize w-fit">
                  {c.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </DashboardLayout>
  );
}
