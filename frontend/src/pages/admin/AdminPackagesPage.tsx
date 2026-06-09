import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Save } from 'lucide-react';

type PackageRow = {
  _id: string;
  network: string;
  bundleSize: string;
  costPrice: number;
  dealerPrice: number;
  resellerBasePrice: number;
  maxSellingPrice: number;
  isEnabled: boolean;
};

type PriceDraft = {
  dealerPrice: string;
  resellerBasePrice: string;
  maxSellingPrice: string;
};

const emptyDraft = (): PriceDraft => ({
  dealerPrice: '',
  resellerBasePrice: '',
  maxSellingPrice: '',
});

function draftsFromPackages(list: PackageRow[]): Record<string, PriceDraft> {
  return Object.fromEntries(
    list.map((p) => [
      p._id,
      {
        dealerPrice: String(p.dealerPrice),
        resellerBasePrice: String(p.resellerBasePrice),
        maxSellingPrice: String(p.maxSellingPrice),
      },
    ])
  );
}

function draftChanged(pkg: PackageRow, draft: PriceDraft) {
  return (
    parseFloat(draft.dealerPrice) !== pkg.dealerPrice ||
    parseFloat(draft.resellerBasePrice) !== pkg.resellerBasePrice ||
    parseFloat(draft.maxSellingPrice) !== pkg.maxSellingPrice
  );
}

export default function AdminPackagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [filter, setFilter] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setPageLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/packages');
      const list = res.data.data as PackageRow[];
      setPackages(list);
      setDrafts(draftsFromPackages(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
      setPackages([]);
      setDrafts({});
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user, load]);

  const seedPackages = async () => {
    setSeeding(true);
    setError('');
    try {
      const res = await api.post('/admin/packages/seed');
      const list = res.data.data as PackageRow[];
      setPackages(list);
      setDrafts(draftsFromPackages(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load default packages');
    } finally {
      setSeeding(false);
    }
  };

  const updateDraft = (id: string, field: keyof PriceDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setSavedId(null);
  };

  const saveRow = async (pkg: PackageRow) => {
    const draft = drafts[pkg._id];
    if (!draft) return;
    setSavingId(pkg._id);
    setError('');
    try {
      await api.patch(`/admin/packages/${pkg._id}/prices`, {
        dealerPrice: parseFloat(draft.dealerPrice),
        resellerBasePrice: parseFloat(draft.resellerBasePrice),
        maxSellingPrice: parseFloat(draft.maxSellingPrice),
      });
      setPackages((prev) =>
        prev.map((p) =>
          p._id === pkg._id
            ? {
                ...p,
                dealerPrice: parseFloat(draft.dealerPrice),
                resellerBasePrice: parseFloat(draft.resellerBasePrice),
                maxSellingPrice: parseFloat(draft.maxSellingPrice),
              }
            : p
        )
      );
      setSavedId(pkg._id);
      setTimeout(() => setSavedId((id) => (id === pkg._id ? null : id)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prices');
    } finally {
      setSavingId(null);
    }
  };

  const toggle = async (id: string) => {
    try {
      await api.patch(`/admin/packages/${id}/toggle`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle package');
    }
  };

  const filtered = filter ? packages.filter((p) => p.network === filter) : packages;
  const networks = [...new Set(packages.map((p) => p.network))];

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Data Packages</h1>
          <p className="text-sm text-gray-400">
            Edit dealer &amp; reseller prices anytime — changes apply to all dealers and resellers.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={load} disabled={pageLoading}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button size="sm" variant={!filter ? 'primary' : 'outline'} onClick={() => setFilter('')}>All</Button>
        {networks.map((n) => (
          <Button key={n} size="sm" variant={filter === n ? 'primary' : 'outline'} onClick={() => setFilter(n)}>{n}</Button>
        ))}
      </div>

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading packages...
        </div>
      ) : packages.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-gray-900 font-medium mb-2">No packages found</p>
          <p className="text-sm text-gray-500 mb-4">Load default MTN, Telecel &amp; AirtelTigo bundles to start editing prices.</p>
          <Button onClick={seedPackages} disabled={seeding}>
            {seeding ? 'Loading...' : 'Load default packages'}
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Network</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Bundle</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Cost</th>
                  <th className="text-left px-4 py-3 text-amber-700 font-medium">Dealer (GHS)</th>
                  <th className="text-left px-4 py-3 text-blue-700 font-medium">Reseller Base (GHS)</th>
                  <th className="text-left px-4 py-3 text-blue-700 font-medium">Max Sell (GHS)</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Save</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const draft = drafts[p._id] || emptyDraft();
                  const changed = draftChanged(p, draft);
                  const isSaving = savingId === p._id;
                  const justSaved = savedId === p._id;
                  return (
                    <tr key={p._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.network}</td>
                      <td className="px-4 py-3 text-gray-900">{p.bundleSize}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(p.costPrice)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.dealerPrice}
                          onChange={(e) => updateDraft(p._id, 'dealerPrice', e.target.value)}
                          className="w-28 px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.resellerBasePrice}
                          onChange={(e) => updateDraft(p._id, 'resellerBasePrice', e.target.value)}
                          className="w-28 px-2 py-1.5 rounded-lg border border-blue-300 bg-blue-50/50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.maxSellingPrice}
                          onChange={(e) => updateDraft(p._id, 'maxSellingPrice', e.target.value)}
                          className="w-28 px-2 py-1.5 rounded-lg border border-blue-300 bg-blue-50/50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggle(p._id)}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${p.isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {p.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => saveRow(p)}
                          disabled={isSaving || !changed}
                          variant={justSaved ? 'primary' : changed ? 'primary' : 'outline'}
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : justSaved ? (
                            'Saved'
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}
