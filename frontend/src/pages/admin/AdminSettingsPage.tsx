import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { redirectToPaystack } from '@/lib/paystack';
import { Loader2, Wallet, Settings, RefreshCw, PlugZap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminPasswordConfirm from '@/components/admin/AdminPasswordConfirm';
import { getApiHostname } from '@/lib/deploy';

type FulfillmentNetwork = 'MTN' | 'Telecel' | 'AirtelTigo';

type FulfillmentSettings = {
  enabled: boolean;
  networkRouting: Record<FulfillmentNetwork, boolean>;
  apiConfigured: boolean;
  providerName?: string;
  apiUrl?: string;
  webhookUrl: string;
};

const FULFILLMENT_NETWORKS: { id: FulfillmentNetwork; label: string }[] = [
  { id: 'MTN', label: 'MTN' },
  { id: 'Telecel', label: 'Telecel' },
  { id: 'AirtelTigo', label: 'AirtelTigo' },
];

type SettingsData = {
  processingFeePercent: number;
  paystackChargePercent: number;
  minWithdrawal: number;
  withdrawalPoolBalance: number;
  totalPoolDeposits: number;
  pendingWithdrawalTotal: number;
  totalResellerProfit: number;
  totalResellerProfitOwed: number;
  totalOwed: number;
  poolShortfall: number;
  recommendedPoolTopUp: number;
};

const defaultSettings: SettingsData = {
  processingFeePercent: 2,
  paystackChargePercent: 2,
  minWithdrawal: 30,
  withdrawalPoolBalance: 0,
  totalPoolDeposits: 0,
  pendingWithdrawalTotal: 0,
  totalResellerProfit: 0,
  totalResellerProfitOwed: 0,
  totalOwed: 0,
  poolShortfall: 0,
  recommendedPoolTopUp: 0,
};

const defaultFulfillment: FulfillmentSettings = {
  enabled: false,
  networkRouting: { MTN: false, Telecel: false, AirtelTigo: false },
  apiConfigured: false,
  webhookUrl: '',
};

function normalizeSettings(data: Partial<SettingsData>): SettingsData {
  return {
    processingFeePercent: Number(data.processingFeePercent) || 2,
    paystackChargePercent: Number(data.paystackChargePercent) || 2,
    minWithdrawal: Number(data.minWithdrawal) || 30,
    withdrawalPoolBalance: Number(data.withdrawalPoolBalance) || 0,
    totalPoolDeposits: Number(data.totalPoolDeposits) || 0,
    pendingWithdrawalTotal: Number(data.pendingWithdrawalTotal) || 0,
    totalResellerProfit: Number(data.totalResellerProfit ?? data.totalResellerProfitOwed) || 0,
    totalResellerProfitOwed: Number(data.totalResellerProfitOwed ?? data.totalResellerProfit) || 0,
    totalOwed: Number(data.totalOwed) || 0,
    poolShortfall: Number(data.poolShortfall) || 0,
    recommendedPoolTopUp: Number(data.recommendedPoolTopUp) || 0,
  };
}

function normalizeFulfillment(data: Partial<FulfillmentSettings> | null): FulfillmentSettings {
  if (!data) return defaultFulfillment;
  return {
    enabled: Boolean(data.enabled),
    apiConfigured: Boolean(data.apiConfigured),
    providerName: data.providerName,
    apiUrl: data.apiUrl,
    webhookUrl: data.webhookUrl || '',
    networkRouting: {
      MTN: data.networkRouting?.MTN ?? false,
      Telecel: data.networkRouting?.Telecel ?? false,
      AirtelTigo: data.networkRouting?.AirtelTigo ?? false,
    },
  };
}

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poolFunded = searchParams.get('poolFunded') === '1';
  const topUpParam = searchParams.get('topUp');
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [paystackFunding, setPaystackFunding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    processingFeePercent: '2',
    paystackChargePercent: '2',
    minWithdrawal: '30',
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState('');
  const [removeNonAdminUsers, setRemoveNonAdminUsers] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSummary, setResetSummary] = useState<Record<string, number> | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentSettings | null>(null);
  const [fulfillmentSaving, setFulfillmentSaving] = useState<FulfillmentNetwork | 'master' | null>(null);
  const [testingApi, setTestingApi] = useState(false);
  const [retryingQueued, setRetryingQueued] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError('');
    const errors: string[] = [];

    const [settingsResult, fulfillmentResult] = await Promise.allSettled([
      api.get('/admin/settings'),
      api.get('/admin/settings/fulfillment'),
    ]);

    if (settingsResult.status === 'fulfilled') {
      const data = normalizeSettings(settingsResult.value.data.data as Partial<SettingsData>);
      setSettings(data);
      setForm({
        processingFeePercent: String(data.processingFeePercent),
        paystackChargePercent: String(data.paystackChargePercent),
        minWithdrawal: String(data.minWithdrawal),
      });
    } else {
      errors.push(
        settingsResult.reason instanceof Error
          ? settingsResult.reason.message
          : 'Failed to load platform settings'
      );
    }

    if (fulfillmentResult.status === 'fulfilled') {
      setFulfillment(
        normalizeFulfillment(fulfillmentResult.value.data.data as Partial<FulfillmentSettings>)
      );
    } else {
      setFulfillment(defaultFulfillment);
      errors.push(
        fulfillmentResult.reason instanceof Error
          ? fulfillmentResult.reason.message
          : 'Failed to load API routing settings'
      );
    }

    if (errors.length === 2) {
      setLoadError(errors[0]);
    } else if (errors.length === 1) {
      setLoadError(`${errors[0]} (other sections loaded)`);
    }

    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user, load]);

  useEffect(() => {
    if (!topUpParam) return;
    const amount = Number(topUpParam);
    if (Number.isFinite(amount) && amount > 0) {
      setDepositAmount(String(amount));
    }
  }, [topUpParam]);

  const runPlatformReset = async () => {
    if (resetConfirmPhrase !== 'RESET PLATFORM') {
      setError('Type RESET PLATFORM exactly to confirm');
      return;
    }
    if (!/^\d{6}$/.test(resetOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }
    const confirmed = window.confirm(
      removeNonAdminUsers
        ? 'This will delete ALL orders, complaints, withdrawals, wallet history, and remove every agent and reseller account. Admin accounts are kept. Continue?'
        : 'This will delete ALL orders, complaints, withdrawals, and reset every wallet balance and profit to zero. User accounts are kept. Continue?'
    );
    if (!confirmed) return;

    setResetting(true);
    setError('');
    setMessage('');
    setResetSummary(null);
    try {
      const res = await api.post('/admin/production-reset', {
        confirmPhrase: resetConfirmPhrase,
        removeNonAdminUsers,
        adminOtp: resetOtp,
      });
      setResetSummary(res.data.data);
      setMessage(res.data.message || 'Platform reset complete.');
      setResetConfirmPhrase('');
      setResetOtp('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Platform reset failed');
    } finally {
      setResetting(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put('/admin/settings', {
        processingFeePercent: parseFloat(form.processingFeePercent),
        paystackChargePercent: parseFloat(form.paystackChargePercent),
        minWithdrawal: parseFloat(form.minWithdrawal),
        adminOtp,
      });
      setMessage('Platform settings saved.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const fundPoolViaPaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }
    setPaystackFunding(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/settings/withdrawal-pool/fund', {
        amount: parseFloat(depositAmount),
        note: depositNote || undefined,
        adminOtp,
      });
      redirectToPaystack(res.data.data.authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Paystack payment');
      setPaystackFunding(false);
    }
  };

  const addPoolFundsManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }
    setDepositing(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/settings/withdrawal-pool/deposit', {
        amount: parseFloat(depositAmount),
        note: depositNote || undefined,
        adminOtp,
      });
      setMessage(res.data.message || 'Funds recorded in withdrawal pool.');
      setDepositAmount('');
      setDepositNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds');
    } finally {
      setDepositing(false);
    }
  };

  const saveFulfillment = async (patch: {
    enabled?: boolean;
    networkRouting?: Partial<Record<FulfillmentNetwork, boolean>>;
  }, savingKey: FulfillmentNetwork | 'master') => {
    if (!fulfillment) return;
    setFulfillmentSaving(savingKey);
    setError('');
    setMessage('');
    try {
      const res = await api.put('/admin/settings/fulfillment', {
        enabled: patch.enabled ?? fulfillment.enabled,
        networkRouting: {
          ...fulfillment.networkRouting,
          ...patch.networkRouting,
        },
      });
      setFulfillment(normalizeFulfillment(res.data.data as Partial<FulfillmentSettings>));
      setMessage('External API routing updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API routing');
    } finally {
      setFulfillmentSaving(null);
    }
  };

  const toggleNetworkRouting = (network: FulfillmentNetwork) => {
    if (!fulfillment) return;
    saveFulfillment(
      { networkRouting: { [network]: !fulfillment.networkRouting[network] } },
      network
    );
  };

  const testFulfillmentApi = async () => {
    setTestingApi(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/settings/fulfillment/test');
      setMessage(res.data.data?.message || 'Smart Data Hub connection successful.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API connection test failed');
    } finally {
      setTestingApi(false);
    }
  };

  const retryQueuedOrders = async () => {
    setRetryingQueued(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/settings/fulfillment/retry-queued');
      const count = res.data.data?.retried ?? 0;
      setMessage(
        count > 0
          ? `Resubmitted ${count} queued order(s) to Smart Data Hub.`
          : 'No queued orders needed resubmission.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry queued orders');
    } finally {
      setRetryingQueued(false);
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

      {poolFunded && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg mb-4">
          Withdrawal pool funded via Paystack. Balance updated.
        </p>
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
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <PlugZap className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Smart Data Hub API routing
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Orders are sent to Smart Data Hub (HMAC-SHA256). Choose which networks forward
              automatically. If the provider wallet is empty, orders queue and resubmit when
              you fund the account — no duplicates (idempotency per order ID).
            </p>

            {!fulfillment?.apiConfigured && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                Set <code className="text-xs">FULFILLMENT_API_ENABLED=true</code>,{' '}
                <code className="text-xs">FULFILLMENT_API_KEY</code>, and{' '}
                <code className="text-xs">FULFILLMENT_API_SECRET</code> on the server. Whitelist{' '}
                <code className="text-xs">{getApiHostname()}</code> in Smart Data
                Hub → API Management.
              </p>
            )}

            {fulfillment && (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <Button
                    type="button"
                    size="sm"
                    variant={fulfillment.enabled ? 'primary' : 'outline'}
                    disabled={fulfillmentSaving !== null}
                    onClick={() => saveFulfillment({ enabled: !fulfillment.enabled }, 'master')}
                  >
                    {fulfillmentSaving === 'master'
                      ? 'Saving...'
                      : fulfillment.enabled
                        ? 'API forwarding: ON'
                        : 'API forwarding: OFF'}
                  </Button>
                  <span className="text-xs text-gray-500">
                    Master switch — turns off all networks at once
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  {FULFILLMENT_NETWORKS.map((network) => {
                    const active =
                      fulfillment.enabled && fulfillment.networkRouting[network.id];
                    return (
                      <button
                        key={network.id}
                        type="button"
                        disabled={fulfillmentSaving !== null || !fulfillment.enabled}
                        onClick={() => toggleNetworkRouting(network.id)}
                        className={cn(
                          'rounded-xl border-2 p-4 text-left transition',
                          active
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                          !fulfillment.enabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <p className="font-semibold text-gray-900">{network.label}</p>
                        <p className="text-sm mt-1 text-gray-600">
                          {fulfillmentSaving === network.id
                            ? 'Saving...'
                            : active
                              ? 'Sending to external API'
                              : 'Not sent to external API'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={testingApi || !fulfillment.apiConfigured}
                    onClick={testFulfillmentApi}
                  >
                    {testingApi ? 'Testing...' : 'Test API connection'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={retryingQueued || !fulfillment.apiConfigured}
                    onClick={retryQueuedOrders}
                  >
                    {retryingQueued ? 'Retrying...' : 'Retry queued orders'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 break-all">
                  Provider: {fulfillment.providerName || 'Smart Data Hub'} —{' '}
                  {fulfillment.apiUrl || 'https://smartdatahubgh.com/api/v1'}
                </p>
              </>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Reseller withdrawal pool</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Admin profit</strong> per delivered order is <strong>reseller/agent base price − Smart Data API cost</strong>. Reseller profit per sale is <strong>their selling price − reseller base price</strong>. When orders deliver, reseller profit is credited — fund the pool to cover withdrawals.
            </p>

            {settings.poolShortfall > 0 && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-800">Pool shortfall: {formatCurrency(settings.poolShortfall)}</p>
                <p className="text-xs text-red-700 mt-1">
                  Owed to resellers ({formatCurrency(settings.totalResellerProfitOwed)}) plus pending withdrawals ({formatCurrency(settings.pendingWithdrawalTotal)}) exceeds the pool balance. Add at least {formatCurrency(settings.recommendedPoolTopUp)}.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setDepositAmount(String(settings.recommendedPoolTopUp))}
                >
                  Use recommended amount
                </Button>
              </div>
            )}

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
                <p className="text-xl font-bold text-blue-800">{formatCurrency(settings.totalResellerProfitOwed || settings.totalResellerProfit)}</p>
              </div>
              <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 col-span-2">
                <p className="text-xs text-gray-500">Total liability (owed + pending withdrawals)</p>
                <p className="text-xl font-bold text-violet-800">{formatCurrency(settings.totalOwed)}</p>
              </div>
            </div>

            <form noValidate className="space-y-4">
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
              <AdminPasswordConfirm value={adminOtp} onChange={setAdminOtp} />
              <p className="text-xs text-gray-500 -mt-2">
                This code confirms withdrawal pool funding on this page.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={paystackFunding || !depositAmount}
                onClick={fundPoolViaPaystack}
              >
                {paystackFunding ? 'Opening Paystack...' : 'Fund pool via Paystack (MoMo / Card)'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={depositing || !depositAmount}
                onClick={addPoolFundsManual}
              >
                {depositing ? 'Recording...' : 'Record manual deposit (cash / bank already received)'}
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
                label="Paystack charge (%) — agent & reseller wallet top-ups"
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
              <AdminPasswordConfirm value={adminOtp} onChange={setAdminOtp} />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </Button>
            </form>
          </Card>

          <Card className="p-6 border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Reset platform data</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Permanently clears all orders, complaints, withdrawals, wallet transactions, audit logs, and
              notification history. All wallet balances, profit, referral earnings, and the withdrawal pool
              return to zero. Packages and user accounts stay unless you choose to remove agents and resellers.
            </p>

            <label className="flex items-start gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={removeNonAdminUsers}
                onChange={(e) => setRemoveNonAdminUsers(e.target.checked)}
              />
              <span>
                Also delete all agent and reseller accounts (admin logins are kept). Use only when starting
                completely fresh.
              </span>
            </label>

            <div className="space-y-4">
              <Input
                label='Type "RESET PLATFORM" to confirm'
                value={resetConfirmPhrase}
                onChange={(e) => setResetConfirmPhrase(e.target.value)}
                placeholder="RESET PLATFORM"
                autoComplete="off"
              />
              <AdminPasswordConfirm value={resetOtp} onChange={setResetOtp} />
              <Button
                type="button"
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
                disabled={resetting}
                onClick={runPlatformReset}
              >
                {resetting ? 'Resetting platform...' : 'Reset all platform data'}
              </Button>
            </div>

            {resetSummary && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700 space-y-1">
                <p>Orders deleted: {resetSummary.ordersDeleted}</p>
                <p>Complaints deleted: {resetSummary.complaintsDeleted}</p>
                <p>Withdrawals deleted: {resetSummary.withdrawalsDeleted}</p>
                <p>Wallet transactions deleted: {resetSummary.walletTransactionsDeleted}</p>
                <p>Wallets reset: {resetSummary.walletsReset}</p>
                {resetSummary.usersRemoved > 0 && <p>Users removed: {resetSummary.usersRemoved}</p>}
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
