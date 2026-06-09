import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = async () => {
    setPageLoading(true);
    try {
      const res = await api.get('/admin/resellers');
      setResellers(res.data.data);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const toggleStore = async (id: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/admin/resellers/${id}/toggle`);
      load();
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleComplaints = async (id: string, enabled: boolean) => {
    setUpdatingId(id);
    try {
      await api.patch(`/admin/resellers/${id}/complaint-access`, { complaintEnabled: enabled });
      load();
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Resellers</h1>
      <p className="text-sm text-gray-400 mb-6">Manage reseller stores, earnings, and complaint access.</p>

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading resellers...
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Store</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Withdrawable</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Total Paid Out</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Store</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Complaints</th>
                </tr>
              </thead>
              <tbody>
                {resellers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">No resellers yet</td>
                  </tr>
                ) : (
                  resellers.map((r) => {
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
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => toggleStore(r._id)}
                          >
                            {storeActive ? 'Disable store' : 'Enable store'}
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => toggleComplaints(r._id, !complaintsAllowed)}
                          >
                            {complaintsAllowed ? 'Disable complaints' : 'Enable complaints'}
                          </Button>
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
