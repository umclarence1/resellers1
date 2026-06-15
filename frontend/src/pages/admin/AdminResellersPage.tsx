import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ActionChip from '@/components/admin/ActionChip';
import { Gift, Loader2, MessageSquare, Store, Trash2 } from 'lucide-react';
import AdminRewardModal from '@/components/admin/AdminRewardModal';
import ScrollTable from '@/components/ui/ScrollTable';
import { MobileDataCard, MobileDataCardList, MobileDataCardRow } from '@/components/ui/MobileDataCard';

type ResellerRow = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  complaintEnabled?: boolean;
  profitBalance: number;
  totalWithdrawals: number;
  resellerStore?: {
    storeName: string;
    slug: string;
    isActive: boolean;
  };
};

export default function AdminResellersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rewardTarget, setRewardTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = async () => {
    setPageLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/resellers');
      setResellers(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resellers');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const toggleStore = async (id: string) => {
    setUpdatingId(id);
    setError('');
    try {
      await api.patch(`/admin/resellers/${id}/toggle`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update store');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleComplaints = async (id: string, enabled: boolean) => {
    setUpdatingId(id);
    setError('');
    try {
      await api.patch(`/admin/resellers/${id}/complaint-access`, { complaintEnabled: enabled });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaints');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteAccount = async (r: ResellerRow) => {
    const confirmed = window.confirm(
      `Delete ${r.fullName}'s account permanently?\n\nThis cannot be undone. Orders history will remain, but they will no longer be able to log in.`
    );
    if (!confirmed) return;

    setUpdatingId(r._id);
    setError('');
    try {
      await api.delete(`/admin/resellers/${r._id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Resellers</h1>
      <p className="text-sm text-gray-400 mb-6">Manage reseller stores, earnings, and complaint access.</p>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading resellers...
        </div>
      ) : (
        <Card className="overflow-hidden">
          {resellers.length === 0 ? (
            <p className="p-10 text-center text-gray-500 text-sm">No resellers yet</p>
          ) : (
            <MobileDataCardList>
              {resellers.map((r) => {
                const storeActive = r.resellerStore?.isActive !== false;
                const complaintsAllowed = r.complaintEnabled !== false;
                const busy = updatingId === r._id;
                return (
                  <MobileDataCard
                    key={r._id}
                    actions={
                      <div className="flex flex-wrap gap-1.5 w-full">
                        <ActionChip
                          title={storeActive ? 'Disable store' : 'Enable store'}
                          active={storeActive}
                          activeTone="emerald"
                          inactiveTone="slate"
                          disabled={busy}
                          onClick={() => toggleStore(r._id)}
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Store className="w-3 h-3" />}
                          {storeActive ? 'Store on' : 'Store off'}
                        </ActionChip>
                        <ActionChip
                          title={complaintsAllowed ? 'Disable complaints' : 'Enable complaints'}
                          active={complaintsAllowed}
                          activeTone="sky"
                          inactiveTone="slate"
                          disabled={busy}
                          onClick={() => toggleComplaints(r._id, !complaintsAllowed)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {complaintsAllowed ? 'Complaints on' : 'Complaints off'}
                        </ActionChip>
                        <ActionChip
                          title="Send reward"
                          active
                          activeTone="amber"
                          disabled={busy}
                          onClick={() => setRewardTarget({ id: r._id, fullName: r.fullName })}
                        >
                          <Gift className="w-3 h-3" />
                          Reward
                        </ActionChip>
                        <ActionChip
                          title="Delete account"
                          active={false}
                          inactiveTone="rose"
                          disabled={busy}
                          onClick={() => deleteAccount(r)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </ActionChip>
                      </div>
                    }
                  >
                    <p className="text-sm font-semibold text-gray-900 mb-2">{r.fullName}</p>
                    <div className="space-y-1.5">
                      <MobileDataCardRow label="Store" value={r.resellerStore?.storeName || '—'} />
                      <MobileDataCardRow label="Email" value={r.email} />
                      <MobileDataCardRow label="Withdrawable" value={formatCurrency(r.profitBalance)} />
                      <MobileDataCardRow label="Paid out" value={formatCurrency(r.totalWithdrawals)} />
                    </div>
                  </MobileDataCard>
                );
              })}
            </MobileDataCardList>
          )}

          <ScrollTable className="hidden md:block">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Store</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Withdrawable</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Paid Out</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Controls</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((r) => {
                    const storeActive = r.resellerStore?.isActive !== false;
                    const complaintsAllowed = r.complaintEnabled !== false;
                    const busy = updatingId === r._id;
                    return (
                      <tr key={r._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{r.fullName}</td>
                        <td className="px-4 py-3 text-gray-700">{r.resellerStore?.storeName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 break-all">{r.email}</td>
                        <td className="px-4 py-3 text-emerald-700 font-semibold">{formatCurrency(r.profitBalance)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(r.totalWithdrawals)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ActionChip
                              title={storeActive ? 'Disable store' : 'Enable store'}
                              active={storeActive}
                              activeTone="emerald"
                              inactiveTone="slate"
                              disabled={busy}
                              onClick={() => toggleStore(r._id)}
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Store className="w-3 h-3" />}
                              {storeActive ? 'Store on' : 'Store off'}
                            </ActionChip>

                            <ActionChip
                              title={complaintsAllowed ? 'Disable complaints' : 'Enable complaints'}
                              active={complaintsAllowed}
                              activeTone="sky"
                              inactiveTone="slate"
                              disabled={busy}
                              onClick={() => toggleComplaints(r._id, !complaintsAllowed)}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {complaintsAllowed ? 'Complaints on' : 'Complaints off'}
                            </ActionChip>

                            <ActionChip
                              title="Send reward"
                              active
                              activeTone="amber"
                              disabled={busy}
                              onClick={() => setRewardTarget({ id: r._id, fullName: r.fullName })}
                            >
                              <Gift className="w-3 h-3" />
                              Reward
                            </ActionChip>

                            <ActionChip
                              title="Delete account"
                              active={false}
                              inactiveTone="rose"
                              disabled={busy}
                              onClick={() => deleteAccount(r)}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </ActionChip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </ScrollTable>
        </Card>
      )}
      {rewardTarget && (
        <AdminRewardModal
          role="reseller"
          userId={rewardTarget.id}
          fullName={rewardTarget.fullName}
          onClose={() => setRewardTarget(null)}
          onSuccess={load}
        />
      )}
    </DashboardLayout>
  );
}
