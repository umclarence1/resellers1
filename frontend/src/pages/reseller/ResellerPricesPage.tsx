import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getNetworkImage } from '@/lib/network-images';

const NETWORK_ORDER = ['MTN', 'Telecel', 'AirtelTigo'] as const;

interface PackageRow {
  _id: string;
  network: string;
  bundleSize: string;
  resellerBasePrice: number;
  maxSellingPrice: number;
  myPrice: number;
}

export default function ResellerPricesPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'reseller')) navigate('/login/reseller');
  }, [user, loading, navigate]);

  const loadPrices = () => {
    setPageLoading(true);
    setSessionExpired(false);
    api
      .get('/reseller/prices')
      .then((res) => {
        setPackages(res.data.data);
        setError('');
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load prices';
        setError(message);
        if (message.includes('Account not found') || message.includes('Authentication required')) {
          setSessionExpired(true);
        }
      })
      .finally(() => setPageLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'reseller') loadPrices();
  }, [user]);

  const savePrice = async (packageId: string) => {
    setError('');
    setSaving(true);
    try {
      await api.put(`/reseller/prices/${packageId}`, { price: parseFloat(price) });
      setEditing(null);
      loadPrices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  const grouped = packages.reduce<Record<string, PackageRow[]>>((acc, pkg) => {
    if (!acc[pkg.network]) acc[pkg.network] = [];
    acc[pkg.network].push(pkg);
    return acc;
  }, {});

  const orderedNetworks = NETWORK_ORDER.filter((network) => grouped[network]?.length);

  return (
    <DashboardLayout role="reseller">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Price Management</h1>
      <p className="text-sm text-gray-400 mb-6">
        Set your selling prices for MTN, Telecel, and AirtelTigo bundles within the allowed range.
      </p>

      {error && !sessionExpired && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {sessionExpired ? (
        <Card className="p-8 text-center max-w-md">
          <p className="text-gray-900 font-medium mb-2">Session expired</p>
          <p className="text-sm text-gray-500 mb-6">
            Your login is no longer valid. Please sign in again to manage prices.
          </p>
          <Button
            onClick={() => {
              logout();
              navigate('/login/reseller');
            }}
          >
            Log in again
          </Button>
        </Card>
      ) : pageLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading packages...
        </div>
      ) : packages.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-900 font-medium">No packages available yet.</p>
          <p className="text-sm text-gray-500 mt-2">
            Ask admin to enable MTN, Telecel, and AirtelTigo packages on the platform.
          </p>
          <Button variant="outline" className="mt-4" onClick={loadPrices}>
            Retry
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedNetworks.map((network) => {
            const items = grouped[network];
            const imageUrl = getNetworkImage(network);
            return (
              <Card key={network} className="overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={network}
                      className="w-9 h-9 rounded-full object-cover border border-gray-200"
                    />
                  ) : null}
                  <h3 className="font-semibold text-gray-900">{network}</h3>
                  <span className="text-xs text-gray-500 ml-auto">{items.length} bundles</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="bg-white border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Bundle</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Base Price</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Max Price</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Your Price</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.bundleSize}</td>
                          <td className="px-4 py-3 text-gray-600">{formatCurrency(p.resellerBasePrice)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatCurrency(p.maxSellingPrice)}</td>
                          <td className="px-4 py-3">
                            {editing === p._id ? (
                              <input
                                type="number"
                                step="0.01"
                                min={p.resellerBasePrice}
                                max={p.maxSellingPrice}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none"
                              />
                            ) : (
                              <span className="font-semibold text-emerald-700">{formatCurrency(p.myPrice)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
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
                                  setPrice(String(p.myPrice));
                                  setError('');
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!sessionExpired && packages.length > 0 && (
        <p className="text-xs text-gray-500 mt-6">
          Tip: You can also set prices from{' '}
          <Link to="/reseller/store" className="text-gold hover:underline">My Store</Link>.
        </p>
      )}
    </DashboardLayout>
  );
}
