import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, ArrowLeft } from 'lucide-react';
import { computeResellerProfit } from '@/lib/reseller-profit';
import {
  PanelTable,
  PanelTableHeader,
  PanelTableScroll,
  panelTableHeadClass,
  panelTableTh,
  panelTableRowClass,
  panelTableCellClass,
} from '@/components/ui/PanelTable';

interface PriceRow {
  _id: string;
  network: string;
  bundleSize: string;
  parentCost: number;
  assignedFloor?: number;
  floor: number;
  maxSellingPrice: number;
  profitPerSale: number;
  maxProfitPerSale: number;
}

interface ChildInfo {
  _id: string;
  fullName: string;
  storeName: string;
  slug: string;
}

export default function ResellerSubResellerPricesPage() {
  const { childId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [child, setChild] = useState<ChildInfo | null>(null);
  const [packages, setPackages] = useState<PriceRow[]>([]);
  const [checkerPackages, setCheckerPackages] = useState<PriceRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'reseller')) navigate('/login/reseller');
  }, [user, loading, navigate]);

  const load = () => {
    if (!childId) return;
    setPageLoading(true);
    api
      .get(`/reseller/sub-resellers/${childId}/prices`)
      .then((res) => {
        setChild(res.data.data.child);
        setPackages(res.data.data.packages);
        setCheckerPackages(res.data.data.checkerPackages || []);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setPageLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'reseller' && childId) load();
  }, [user, childId]);

  const savePrice = async (packageId: string) => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/reseller/sub-resellers/${childId}/prices/${packageId}`, {
        price: parseFloat(price),
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setSaving(false);
    }
  };

  const renderTable = (title: string, rows: PriceRow[]) => (
    <PanelTable>
      <PanelTableHeader title={title} trailing={`${rows.length} items`} />
      <PanelTableScroll minWidth={560}>
        <thead className={panelTableHeadClass}>
          <tr>
            <th className={panelTableTh()}>Bundle</th>
            <th className={panelTableTh()}>Your cost</th>
            <th className={panelTableTh()}>Max</th>
            <th className={panelTableTh()}>Their floor</th>
            <th className={panelTableTh('emerald')}>Your margin</th>
            <th className={panelTableTh()}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const draft = editing === p._id ? parseFloat(price) : p.assignedFloor ?? p.floor;
            const liveProfit = Number.isFinite(draft)
              ? computeResellerProfit(draft, p.parentCost)
              : p.profitPerSale;
            return (
              <tr key={p._id} className={panelTableRowClass}>
                <td className={cn(panelTableCellClass, 'font-medium text-gray-900')}>
                  {p.network !== 'MTN' || p.bundleSize.includes('GB') ? p.bundleSize : `${p.network} ${p.bundleSize}`}
                </td>
                <td className={cn(panelTableCellClass, 'text-gray-600')}>{formatCurrency(p.parentCost)}</td>
                <td className={cn(panelTableCellClass, 'text-gray-600')}>{formatCurrency(p.maxSellingPrice)}</td>
                <td className={panelTableCellClass}>
                  {editing === p._id ? (
                    <input
                      type="number"
                      step="0.01"
                      min={p.parentCost}
                      max={p.maxSellingPrice}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none"
                    />
                  ) : (
                    <span className="font-semibold text-violet-700">
                      {p.assignedFloor !== undefined ? formatCurrency(p.assignedFloor) : '—'}
                    </span>
                  )}
                </td>
                <td className={panelTableCellClass}>
                  <span className="font-semibold text-emerald-700">{formatCurrency(liveProfit)}</span>
                </td>
                <td className={panelTableCellClass}>
                  {editing === p._id ? (
                    <div className="flex gap-2">
                      <Button size="sm" loading={saving} onClick={() => savePrice(p._id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(p._id);
                        setPrice(String(p.assignedFloor ?? p.parentCost));
                        setError('');
                      }}
                    >
                      {p.assignedFloor !== undefined ? 'Edit' : 'Set'}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </PanelTableScroll>
    </PanelTable>
  );

  if (loading || !user) return null;

  return (
    <DashboardLayout role="reseller">
      <Link
        to="/reseller/sub-resellers"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Resellers
      </Link>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Sub-Reseller Prices</h1>
      {child && (
        <p className="text-sm text-gray-400 mb-6">
          Set floor prices for <span className="text-white font-medium">{child.fullName}</span> ({child.storeName}).
          They sell above these prices and you earn the margin.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-6">
          {packages.length > 0 && renderTable('Data Bundles', packages)}
          {checkerPackages.length > 0 && renderTable('Results Checkers', checkerPackages)}
        </div>
      )}
    </DashboardLayout>
  );
}
