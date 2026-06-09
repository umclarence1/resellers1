import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import FormAlert from '@/components/ui/FormAlert';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function DealerBulkPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [networks, setNetworks] = useState<string[]>([]);
  const [network, setNetwork] = useState('');
  const [lines, setLines] = useState('');
  const [validated, setValidated] = useState<Array<Record<string, unknown>> | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'dealer')) navigate('/login/dealer');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'dealer') api.get('/dealer/networks').then((res) => setNetworks(res.data.data));
  }, [user]);

  const validate = async () => {
    try {
      const res = await api.post('/dealer/bulk/validate', { lines, network });
      setValidated(res.data.data.validated);
      setTotalCost(res.data.data.totalCost);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      setSuccess('');
      setValidated(null);
    }
  };

  const confirm = async () => {
    try {
      const res = await api.post('/dealer/bulk/purchase', { validated });
      setSuccess(`${res.data.data.length} orders created successfully!`);
      setError('');
      setValidated(null);
      setLines('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setSuccess('');
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="dealer">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Bulk Purchase</h1>
      <Card className="p-6 max-w-2xl space-y-5">
        <Select
          label="Network"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          options={[{ value: '', label: 'Choose network...' }, ...networks.map((n) => ({ value: n, label: n }))]}
        />

        <Textarea
          label="Bulk entries"
          hint="One entry per line — phone number, then bundle size (GB)."
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          placeholder={`0595399837 4\n0241234567 2\n0541234567 10`}
          rows={8}
        />

        <div className="flex flex-wrap gap-3">
          <Button onClick={validate} disabled={!lines.trim() || !network}>Validate</Button>
          {validated && (
            <Button variant="secondary" onClick={confirm}>
              Confirm Purchase ({formatCurrency(totalCost)})
            </Button>
          )}
        </div>

        <FormAlert message={error} />
        {success && (
          <p className="text-sm p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            {success}
          </p>
        )}
        {validated && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead><tr className="border-b"><th className="text-left py-2">Number</th><th className="text-left py-2">Bundle</th><th className="text-left py-2">Price</th></tr></thead>
              <tbody>
                {validated.map((v, i) => (
                  <tr key={i} className="border-b"><td className="py-2">{v.phone as string}</td><td>{v.bundleSize as string}</td><td>{formatCurrency(v.price as number)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
