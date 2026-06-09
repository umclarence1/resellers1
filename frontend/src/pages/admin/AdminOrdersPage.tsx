import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, downloadAdminReport } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, RefreshCw } from 'lucide-react';

interface OrderRow {
  _id: string;
  orderId: string;
  customerEmail?: string;
  recipientPhone: string;
  network: string;
  bundleSize: string;
  status: string;
  source: string;
  sellingPrice: number;
  profit: number;
  totalAmount: number;
  dealerName?: string;
  resellerName?: string;
  storeName?: string;
  createdAt: string;
}

const STATUSES = ['pending', 'processing', 'delivered', 'failed', 'refunded', 'cancelled'];

const SOURCE_FILTERS = [
  { value: '', label: 'All sources' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'dealer_api', label: 'Dealer API' },
  { value: 'reseller_store', label: 'Reseller store' },
];

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-sky-100 text-sky-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-violet-100 text-violet-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function partyLabel(order: OrderRow) {
  if (order.source === 'reseller_store') {
    return order.storeName || order.resellerName || 'Reseller';
  }
  if (order.source === 'dealer' || order.source === 'dealer_api') {
    return order.dealerName || 'Dealer';
  }
  return '—';
}

export default function AdminOrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const loadOrders = useCallback(async () => {
    setPageLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 500 };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      const { data } = await api.get('/admin/orders', { params });
      setOrders(data.data.orders);
      setTotal(data.data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setPageLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    if (user?.role === 'admin') loadOrders();
  }, [user, loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    setError('');
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status });
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, status } : o))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadAdminReport('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">All Orders</h1>
          <p className="text-sm text-gray-400">
            Every order from dealers and reseller stores — {total} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={pageLoading}>
            <RefreshCw className={cn('w-4 h-4', pageLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {SOURCE_FILTERS.map((f) => (
          <Button
            key={f.value || 'all'}
            size="sm"
            variant={sourceFilter === f.value ? 'primary' : 'outline'}
            onClick={() => setSourceFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-navy-border bg-navy-light text-sm text-white"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading orders...
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Order ID</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Party</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Bundle</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Source</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">{order.orderId}</td>
                      <td className="px-4 py-3 text-gray-900">
                        <p className="font-medium">{partyLabel(order)}</p>
                        {order.customerEmail && (
                          <p className="text-xs text-gray-500 break-all">{order.customerEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{order.recipientPhone}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {order.network} · {order.bundleSize}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {formatCurrency(order.sellingPrice || order.totalAmount)}
                        {order.profit > 0 && (
                          <span className="block text-xs text-emerald-600">+{formatCurrency(order.profit)} profit</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{order.source?.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          disabled={updatingId === order.orderId}
                          onChange={(e) => updateStatus(order.orderId, e.target.value)}
                          className={cn(
                            'px-2 py-1 rounded-lg text-xs font-semibold border border-gray-200 capitalize',
                            STATUS_STYLES[order.status] || STATUS_STYLES.pending
                          )}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}
