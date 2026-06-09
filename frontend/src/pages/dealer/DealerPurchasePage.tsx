import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function DealerPurchasePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [networks, setNetworks] = useState<string[]>([]);
  const [packages, setPackages] = useState<Array<Record<string, unknown>>>([]);
  const [network, setNetwork] = useState('');
  const [packageId, setPackageId] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'dealer')) navigate('/login/dealer');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'dealer') {
      api.get('/dealer/networks').then((res) => setNetworks(res.data.data));
    }
  }, [user]);

  useEffect(() => {
    if (network) {
      api.get(`/dealer/packages?network=${network}`).then((res) => setPackages(res.data.data));
    }
  }, [network]);

  const selected = packages.find((p) => p._id === packageId);

  const handlePurchase = async () => {
    setSubmitting(true);
    setMsg('');
    try {
      const res = await api.post('/dealer/purchase', { packageId, recipientPhone: phone });
      setMsg(`Order ${res.data.data.orderId} created successfully!`);
      setPhone('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="dealer">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Buy Data</h1>
      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          <Select
            label="Select Network"
            value={network}
            onChange={(e) => { setNetwork(e.target.value); setPackageId(''); }}
            options={[{ value: '', label: 'Choose network...' }, ...networks.map((n) => ({ value: n, label: n }))]}
          />
          <Select
            label="Select Bundle"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            options={[
              { value: '', label: 'Choose bundle...' },
              ...packages.map((p) => ({ value: p._id as string, label: `${p.bundleSize} - ${formatCurrency(p.dealerPrice as number)}` })),
            ]}
          />
          {selected && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Price: <strong>{formatCurrency(selected.dealerPrice as number)}</strong></p>
            </div>
          )}
          <Input label="Recipient Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0XXXXXXXXX" />
          {msg && <p className={`text-sm p-3 rounded-lg ${msg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</p>}
          <Button onClick={handlePurchase} loading={submitting} disabled={!packageId || !phone} className="w-full">
            Confirm Purchase
          </Button>
        </div>
      </Card>
    </DashboardLayout>
  );
}
