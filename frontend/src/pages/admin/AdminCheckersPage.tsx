import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import {
  PanelTable,
  PanelTableHeader,
  PanelTableScroll,
  panelTableHeadClass,
  panelTableTh,
  panelTableRowClass,
  panelTableCellClass,
} from '@/components/ui/PanelTable';

type CheckerType = 'bece' | 'wassce';

interface CheckerStockRow {
  type: CheckerType;
  inStock: boolean;
  availableCount: number;
  assignedCount: number;
}

interface CheckerSummary {
  bece: CheckerStockRow;
  wassce: CheckerStockRow;
}

interface CheckerListItem {
  _id: string;
  type: CheckerType;
  serial: string;
  pin?: string;
  status: 'available' | 'assigned';
  assignedAt?: string;
  createdAt: string;
}

export default function AdminCheckersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CheckerSummary | null>(null);
  const [items, setItems] = useState<CheckerListItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [uploadType, setUploadType] = useState<CheckerType>('bece');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [toggling, setToggling] = useState<CheckerType | null>(null);
  const [filterType, setFilterType] = useState<CheckerType | ''>('');
  const [filterStatus, setFilterStatus] = useState<'available' | 'assigned' | ''>('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '50');
      const [summaryRes, listRes] = await Promise.all([
        api.get('/admin/checkers/summary'),
        api.get(`/admin/checkers?${params.toString()}`),
      ]);
      setSummary(summaryRes.data.data as CheckerSummary);
      setItems(listRes.data.data as CheckerListItem[]);
    } finally {
      setPageLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user, load]);

  const toggleStock = async (type: CheckerType, inStock: boolean) => {
    setToggling(type);
    try {
      await api.patch(`/admin/checkers/stock/${type}`, { inStock });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update stock');
    } finally {
      setToggling(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadMsg('Choose an Excel file first');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', uploadType);
      const res = await api.post('/admin/checkers/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = res.data.data as { imported: number; skippedDuplicates: number; skippedInvalid: number };
      setUploadMsg(
        `Imported ${d.imported}. Skipped duplicates: ${d.skippedDuplicates}. Invalid rows: ${d.skippedInvalid}.`
      );
      setFile(null);
      await load();
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !user) return null;

  const stockCards: { key: CheckerType; label: string; row?: CheckerStockRow }[] = [
    { key: 'bece', label: 'BECE', row: summary?.bece },
    { key: 'wassce', label: 'WASSCE', row: summary?.wassce },
  ];

  return (
    <DashboardLayout role="admin">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Results Checkers</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {stockCards.map(({ key, label, row }) => (
          <Card key={key} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{label}</h2>
                {row && (
                  <p className="text-sm text-gray-500 mt-1">
                    {row.availableCount} available · {row.assignedCount} used
                  </p>
                )}
                <span
                  className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                    row?.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {row?.inStock ? 'In stock' : 'Out of stock'}
                </span>
              </div>
              {row && (
                <Button
                  size="sm"
                  variant={row.inStock ? 'outline' : 'primary'}
                  loading={toggling === key}
                  onClick={() => toggleStock(key, !row.inStock)}
                >
                  Mark {row.inStock ? 'out of stock' : 'in stock'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload checkers (Excel)
        </h2>
        <form onSubmit={handleUpload} className="space-y-4 max-w-xl">
          <div className="flex gap-2">
            {(['bece', 'wassce'] as CheckerType[]).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={uploadType === t ? 'primary' : 'outline'}
                onClick={() => setUploadType(t)}
              >
                {t.toUpperCase()}
              </Button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Excel must have <strong>Serial</strong> and <strong>PIN</strong> columns in row 1.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-600"
          />
          <Button type="submit" loading={uploading} disabled={!file}>
            Upload to {uploadType.toUpperCase()}
          </Button>
          {uploadMsg && <p className="text-sm text-gray-600">{uploadMsg}</p>}
        </form>
      </Card>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button size="sm" variant={!filterType ? 'primary' : 'outline'} onClick={() => setFilterType('')}>
          All types
        </Button>
        {(['bece', 'wassce'] as CheckerType[]).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={filterType === t ? 'primary' : 'outline'}
            onClick={() => setFilterType(t)}
          >
            {t.toUpperCase()}
          </Button>
        ))}
        <Button
          size="sm"
          variant={filterStatus === 'available' ? 'primary' : 'outline'}
          onClick={() => setFilterStatus(filterStatus === 'available' ? '' : 'available')}
        >
          Unused
        </Button>
        <Button
          size="sm"
          variant={filterStatus === 'assigned' ? 'primary' : 'outline'}
          onClick={() => setFilterStatus(filterStatus === 'assigned' ? '' : 'assigned')}
        >
          Used
        </Button>
      </div>

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading checkers...
        </div>
      ) : (
        <PanelTable>
          <PanelTableHeader title="Checker inventory" trailing={`${items.length} shown`} />
          <PanelTableScroll minWidth={700}>
            <thead className={panelTableHeadClass}>
              <tr>
                <th className={panelTableTh()}>Type</th>
                <th className={panelTableTh()}>Serial</th>
                <th className={panelTableTh()}>Status</th>
                <th className={panelTableTh()}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className={panelTableRowClass}>
                  <td className={panelTableCellClass}>{item.type.toUpperCase()}</td>
                  <td className={panelTableCellClass}>{item.serial}</td>
                  <td className={panelTableCellClass}>
                    <span
                      className={
                        item.status === 'available'
                          ? 'text-emerald-700'
                          : 'text-gray-500'
                      }
                    >
                      {item.status === 'available' ? 'Unused' : 'Used'}
                    </span>
                  </td>
                  <td className={panelTableCellClass}>
                    {item.assignedAt ? new Date(item.assignedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </PanelTableScroll>
        </PanelTable>
      )}
    </DashboardLayout>
  );
}
