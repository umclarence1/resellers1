import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ShoppingCart } from 'lucide-react';

interface OrderRow {
  _id: string;
  orderId: string;
  customerEmail?: string;
  recipientPhone: string;
  network: string;
  bundleSize: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  processing: 'bg-sky-100 text-sky-800 border-sky-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-violet-100 text-violet-800 border-violet-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ResellerOrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'reseller')) navigate('/login/reseller');
  }, [user, loading, navigate]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setPageLoading(true);
    else setRefreshing(true);

    try {
      const { data } = await api.get('/reseller/orders');
      setOrders(data.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'reseller') loadOrders();
  }, [user, loadOrders]);

  useEffect(() => {
    if (user?.role !== 'reseller') return;
    const interval = setInterval(() => loadOrders(true), 30000);
    return () => clearInterval(interval);
  }, [user, loadOrders]);

  if (loading || !user) return null;

  return (
    <DashboardLayout role="reseller">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Store Orders</h1>
          <p className="text-sm text-gray-400">Orders placed through your store link</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-10 text-center">
          <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No orders yet</p>
          <p className="text-sm text-gray-500 mt-2">
            When customers buy data from your store link, their orders will appear here.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Order ID</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Bundle</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{order.orderId}</td>
                    <td className="px-4 py-3 text-gray-700 break-all">{order.customerEmail || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{order.recipientPhone}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {order.network} · {order.bundleSize}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize',
                          STATUS_STYLES[order.status] || STATUS_STYLES.pending
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {orders.length > 0 && (
        <p className="text-xs text-gray-500 mt-4">
          Status updates automatically every 30 seconds when admin changes an order.
        </p>
      )}
    </DashboardLayout>
  );
}
