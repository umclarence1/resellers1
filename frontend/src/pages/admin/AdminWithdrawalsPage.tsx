import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Wallet } from 'lucide-react';

type WithdrawalRow = {
  _id: string;
  amount: number;
  network: string;
  mobileNumber: string;
  accountName: string;
  status: string;
  adminNote?: string;
  paystackTransferStatus?: string;
  paystackTransferReference?: string;
  createdAt: string;
  userId?: { fullName?: string; email?: string };
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function AdminWithdrawalsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [poolBalance, setPoolBalance] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = async () => {
    setPageLoading(true);
    try {
      const [wRes, sRes] = await Promise.all([
        api.get('/admin/withdrawals'),
        api.get('/admin/settings'),
      ]);
      setWithdrawals(wRes.data.data);
      setPoolBalance(sRes.data.data.withdrawalPoolBalance);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/admin/withdrawals/${id}`, { status });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update withdrawal');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Withdrawals</h1>
      <p className="text-sm text-gray-400 mb-6">
        Approve requests to debit the pool and send MoMo via Paystack. Use &quot;Mark paid&quot; if Paystack payout was manual.
      </p>

      <Card className="p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Withdrawal pool balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(poolBalance)}</p>
          </div>
        </div>
        <Link to="/admin/settings">
          <Button>Add funds to pool</Button>
        </Link>
      </Card>

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading withdrawals...
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Reseller</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">MoMo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No withdrawal requests</td>
                  </tr>
                ) : (
                  withdrawals.map((w) => {
                    const busy = updatingId === w._id;
                    return (
                      <tr key={w._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="text-gray-900 font-medium">{w.userId?.fullName || '—'}</p>
                          <p className="text-xs text-gray-500">{w.userId?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-semibold">{formatCurrency(w.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <p>{w.network} · {w.mobileNumber}</p>
                          <p className="text-xs text-gray-500">{w.accountName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[w.status] || 'bg-gray-100 text-gray-600'}`}>
                            {w.status}
                          </span>
                          {w.paystackTransferStatus && (
                            <p className="text-xs text-gray-500 mt-1">Paystack: {w.paystackTransferStatus}</p>
                          )}
                          {w.adminNote && (
                            <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate" title={w.adminNote}>{w.adminNote}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{new Date(w.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {w.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busy || w.amount > poolBalance}
                                  onClick={() => updateStatus(w._id, 'approved')}
                                  title={w.amount > poolBalance ? 'Insufficient pool balance — add funds in Settings' : undefined}
                                >
                                  Approve
                                </Button>
                                {w.amount > poolBalance && (
                                  <span className="text-xs text-red-600">Need {formatCurrency(w.amount - poolBalance)} more in pool</span>
                                )}
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus(w._id, 'rejected')}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {w.status === 'approved' && (
                              <Button size="sm" disabled={busy} onClick={() => updateStatus(w._id, 'paid')}>
                                Mark paid
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}
