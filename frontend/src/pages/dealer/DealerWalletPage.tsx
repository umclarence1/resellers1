import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { redirectToPaystack } from '@/lib/paystack';

export default function DealerWalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const funded = searchParams.get('funded') === '1';
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [fundInfo, setFundInfo] = useState<Record<string, number> | null>(null);
  const [fundError, setFundError] = useState('');
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'dealer')) navigate('/login/dealer');
  }, [user, loading, navigate]);

  const loadWallet = () => api.get('/dealer/wallet').then((res) => setBalance(res.data.data.balance));
  useEffect(() => { if (user?.role === 'dealer') loadWallet(); }, [user]);

  const handleFund = async () => {
    setFundError('');
    setFunding(true);
    try {
      const res = await api.post('/dealer/wallet/fund', { amount: parseFloat(amount) });
      setFundInfo(res.data.data);
      redirectToPaystack(res.data.data.authorizationUrl);
    } catch (err) {
      setFundError(err instanceof Error ? err.message : 'Could not start Paystack payment');
    } finally {
      setFunding(false);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="dealer">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Wallet</h1>
      {funded && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg mb-4">
          Wallet funded successfully. Your balance has been updated.
        </p>
      )}
      <Card className="p-6 max-w-md mb-6">
        <p className="text-sm text-gray-500">Current Balance</p>
        <p className="text-3xl font-bold text-blue-600">{formatCurrency(balance)}</p>
      </Card>
      <Card className="p-6 max-w-md">
        <h2 className="font-semibold mb-4">Fund Wallet via Paystack</h2>
        <p className="text-xs text-gray-500 mb-4">Supports MTN MoMo, Telecel Cash, AirtelTigo Money & Bank Card</p>
        <Input label="Deposit Amount (GHS)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" />
        {fundInfo && (
          <div className="mt-3 text-sm bg-gray-50 p-3 rounded-lg space-y-1">
            <p>Deposit: {formatCurrency(fundInfo.depositAmount)}</p>
            <p>Paystack Charge: {formatCurrency(fundInfo.paystackCharge)}</p>
            <p className="font-bold">Total: {formatCurrency(fundInfo.total)}</p>
          </div>
        )}
        {fundError && <p className="text-sm text-red-600 mt-3">{fundError}</p>}
        <Button onClick={handleFund} className="w-full mt-4" disabled={!amount || funding}>
          {funding ? 'Opening Paystack...' : 'Pay with Paystack (MoMo / Card)'}
        </Button>
      </Card>
    </DashboardLayout>
  );
}
