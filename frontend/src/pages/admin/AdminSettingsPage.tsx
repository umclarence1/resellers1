import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2, Wallet, Settings, RefreshCw } from 'lucide-react';

type SettingsData = {
  processingFeePercent: number;
  paystackChargePercent: number;
  minWithdrawal: number;
  withdrawalPoolBalance: number;
  totalPoolDeposits: number;
  pendingWithdrawalTotal: number;
  totalResellerProfit: number;
};

const defaultSettings: SettingsData = {
  processingFeePercent: 2,
  paystackChargePercent: 1.5,
  minWithdrawal: 30,
  withdrawalPoolBalance: 0,
  totalPoolDeposits: 0,
  pendingWithdrawalTotal: 0,
  totalResellerProfit: 0,
};

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    processingFeePercent: '2',
    paystackChargePercent: '1.5',
    minWithdrawal: '30',
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/admin/settings');
      const data = res.data.data as SettingsData;
      setSettings(data);
      setForm({
        processingFeePercent: String(data.processingFeePercent ?? 2),
        paystackChargePercent: String(data.paystackChargePercent ?? 1.5),
        minWithdrawal: String(data.minWithdrawal ?? 30),
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user, load]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put('/admin/settings', {
        processingFeePercent: parseFloat(form.processingFeePercent),
        paystackChargePercent: parseFloat(form.paystackChargePercent),
        minWithdrawal: parseFloat(form.minWithdrawal),
      });
      setMessage('Platform settings saved.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addPoolFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositing(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/settings/withdrawal-pool/deposit', {
        amount: parseFloat(depositAmount),
        note: depositNote || undefined,
      });
      setMessage(res.data.message || 'Funds added to withdrawal pool.');
      setDepositAmount('');
      setDepositNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds');
    } finally {
      setDepositing(false);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-sm text-gray-400">Platform fees, withdrawal rules, and payout pool funding.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={pageLoading}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {message && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg mb-4">{message}</p>
      )}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading settings...
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Reseller withdrawal pool</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Add real money here so you can pay resellers when you approve their withdrawal requests.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-gray-500">Pool balance</p>
                <p className="text-xl font-bold text-emerald-800">{formatCurrency(settings.withdrawalPoolBalance)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500">Total deposited</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(settings.totalPoolDeposits)}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-gray-500">Pending requests</p>
                <p className="text-xl font-bold text-amber-800">{formatCurrency(settings.pendingWithdrawalTotal)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs text-gray-500">Reseller earnings owed</p>
                <p className="text-xl font-bold text-blue-800">{formatCurrency(settings.totalResellerProfit)}</p>
              </div>
            </div>

            <form noValidate onSubmit={addPoolFunds} className="space-y-4">
              <Input
                label="Amount to add (GHS)"
                type="number"
                step="0.01"
                min="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="e.g. 500"
              />
              <Input
                label="Note (optional)"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="MoMo ref, bank transfer, etc."
              />
              <Button type="submit" className="w-full" disabled={depositing || !depositAmount}>
                {depositing ? 'Adding...' : 'Add money to withdrawal pool'}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Platform settings</h2>
            </div>

            <form noValidate onSubmit={saveSettings} className="space-y-4">
              <Input
                label="Store processing fee (%)"
                type="number"
                step="0.1"
                value={form.processingFeePercent}
                onChange={(e) => setForm((f) => ({ ...f, processingFeePercent: e.target.value }))}
              />
              <Input
                label="Paystack charge (%)"
                type="number"
                step="0.1"
                value={form.paystackChargePercent}
                onChange={(e) => setForm((f) => ({ ...f, paystackChargePercent: e.target.value }))}
              />
              <Input
                label="Minimum reseller withdrawal (GHS)"
                type="number"
                step="1"
                value={form.minWithdrawal}
                onChange={(e) => setForm((f) => ({ ...f, minWithdrawal: e.target.value }))}
              />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
