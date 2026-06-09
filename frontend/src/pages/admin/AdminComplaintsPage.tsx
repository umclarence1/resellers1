import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare, ShieldOff, ShieldCheck } from 'lucide-react';

interface ComplaintRow {
  _id: string;
  orderId: string;
  phoneNumber: string;
  issueType: string;
  description: string;
  status: string;
  adminResponse?: string;
  createdAt: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    complaintEnabled?: boolean;
    resellerStore?: { storeName: string };
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  under_review: 'bg-sky-100 text-sky-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  refunded: 'bg-violet-100 text-violet-800',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AdminComplaintsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const [complaintsRes, settingsRes] = await Promise.all([
        api.get('/admin/complaints'),
        api.get('/admin/settings/complaints'),
      ]);
      setComplaints(complaintsRes.data.data);
      setGlobalEnabled(settingsRes.data.data.globalEnabled);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaints');
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user, load]);

  const resolveComplaint = async (id: string) => {
    setUpdating(id);
    try {
      await api.patch(`/admin/complaints/${id}`, { status: 'resolved' });
      setComplaints((prev) =>
        prev.map((c) => (c._id === id ? { ...c, status: 'resolved' } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint');
    } finally {
      setUpdating(null);
    }
  };

  const toggleGlobal = async () => {
    setUpdating('global');
    try {
      const next = !globalEnabled;
      await api.put('/admin/settings/complaints', { globalEnabled: next });
      setGlobalEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setUpdating(null);
    }
  };

  const toggleResellerAccess = async (resellerId: string, enabled: boolean) => {
    setUpdating(resellerId);
    try {
      await api.patch(`/admin/resellers/${resellerId}/complaint-access`, {
        complaintEnabled: enabled,
      });
      setComplaints((prev) =>
        prev.map((c) =>
          c.userId?._id === resellerId
            ? { ...c, userId: { ...c.userId!, complaintEnabled: enabled } }
            : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reseller access');
    } finally {
      setUpdating(null);
    }
  };

  if (loading || !user) return null;

  const pending = complaints.filter((c) => c.status === 'pending' || c.status === 'under_review');

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Complaints</h1>
          <p className="text-sm text-gray-400">
            {pending.length} open complaint{pending.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant={globalEnabled ? 'outline' : 'primary'}
          size="sm"
          loading={updating === 'global'}
          onClick={toggleGlobal}
          className="w-full sm:w-auto"
        >
          {globalEnabled ? (
            <>
              <ShieldOff className="w-4 h-4" />
              Disable all reseller complaints
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Enable reseller complaints
            </>
          )}
        </Button>
      </div>

      {!globalEnabled && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-4">
          Complaints are disabled globally — resellers cannot submit new complaints.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading complaints...
        </div>
      ) : complaints.length === 0 ? (
        <Card className="p-10 text-center">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No complaints yet</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => {
            const reseller = c.userId;
            const complaintsAllowed = reseller?.complaintEnabled !== false;
            return (
              <Card key={c._id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-semibold capitalize',
                          STATUS_STYLES[c.status] || STATUS_STYLES.pending
                        )}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{c.orderId}</span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      Phone: <span className="text-gold">{c.phoneNumber}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {c.issueType} — {c.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Reseller: {reseller?.fullName || '—'} ({reseller?.email}) ·{' '}
                      {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {c.status !== 'resolved' && (
                      <Button
                        size="sm"
                        loading={updating === c._id}
                        onClick={() => resolveComplaint(c._id)}
                      >
                        Mark resolved
                      </Button>
                    )}
                    {reseller?._id && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={updating === reseller._id}
                        onClick={() => toggleResellerAccess(reseller._id, !complaintsAllowed)}
                      >
                        {complaintsAllowed ? 'Disable complaints' : 'Enable complaints'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
