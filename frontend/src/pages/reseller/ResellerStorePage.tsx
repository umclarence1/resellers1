import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FormAlert from '@/components/ui/FormAlert';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Store, Tag } from 'lucide-react';
import { runValidators, v } from '@/lib/form-validation';

interface StoreData {
  storeName: string;
  slug: string;
  phone: string;
  whatsapp: string;
  supportEmail: string;
  isActive: boolean;
  storeUrl: string;
}

interface PackageRow {
  _id: string;
  network: string;
  bundleSize: string;
  resellerBasePrice: number;
  maxSellingPrice: number;
  myPrice: number;
}

export default function ResellerStorePage() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreData | null>(null);
  const [form, setForm] = useState({ storeName: '', phone: '', whatsapp: '', supportEmail: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'reseller')) navigate('/login/reseller');
  }, [user, loading, navigate]);

  const loadStore = () =>
    api.get('/reseller/store').then((res) => {
      const data = res.data.data as StoreData;
      setStore(data);
      setForm({
        storeName: data.storeName || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        supportEmail: data.supportEmail || user?.email || '',
      });
    });

  const loadPrices = () =>
    api.get('/reseller/prices').then((res) => setPackages(res.data.data));

  useEffect(() => {
    if (user?.role === 'reseller') {
      loadStore().catch(console.error);
      loadPrices();
    }
  }, [user]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setError('');
    setSuccess('');
  };

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errors = runValidators(form, {
      storeName: [v.required('Store name')],
      phone: [v.required('Phone'), v.phone],
      whatsapp: [v.required('WhatsApp'), v.phone],
      supportEmail: [v.required('Support email'), v.email],
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const { data } = await api.put('/reseller/store', form);
      const updated = data.data as StoreData;
      setStore(updated);
      setSuccess('Store saved! Your store link is ready.');
      if (user?.resellerStore) {
        setUser({
          ...user,
          resellerStore: {
            ...user.resellerStore,
            storeName: updated.storeName,
            slug: updated.slug,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async (packageId: string) => {
    setPriceSaving(true);
    setError('');
    try {
      await api.put(`/reseller/prices/${packageId}`, { price: parseFloat(editPrice) });
      setEditingId(null);
      await loadPrices();
      setSuccess('Price updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setPriceSaving(false);
    }
  };

  const copyLink = async () => {
    if (!store?.storeUrl) return;
    await navigator.clipboard.writeText(store.storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !user) return null;

  const grouped = packages.reduce<Record<string, PackageRow[]>>((acc, pkg) => {
    if (!acc[pkg.network]) acc[pkg.network] = [];
    acc[pkg.network].push(pkg);
    return acc;
  }, {});

  return (
    <DashboardLayout role="reseller">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">My Store</h1>
      <p className="text-sm text-gray-400 mb-6">Set up your store name, get your link, and set prices within admin limits.</p>

      <FormAlert message={error} />
      {success && (
        <p className="mb-4 text-sm p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          {success}
        </p>
      )}

      {store?.storeUrl && store.isActive && (
        <Card className="p-5 mb-6 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-1">Your store link</p>
              <p className="font-mono text-sm text-gray-800 break-all">{store.storeUrl}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <a href={store.storeUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary">
                  <ExternalLink className="w-4 h-4" />
                  Visit
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-gray-900">Store details</h2>
          </div>
          <form noValidate onSubmit={saveStore} className="space-y-4">
            <Input
              label="Store name"
              value={form.storeName}
              error={fieldErrors.storeName}
              onChange={(e) => updateField('storeName', e.target.value)}
              placeholder="e.g. FastData GH"
            />
            <p className="text-xs text-gray-500 -mt-2">Your store link is generated from this name.</p>
            <Input
              label="Phone"
              value={form.phone}
              error={fieldErrors.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="0XXXXXXXXX"
            />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              error={fieldErrors.whatsapp}
              onChange={(e) => updateField('whatsapp', e.target.value)}
              placeholder="0XXXXXXXXX"
            />
            <Input
              label="Support email"
              type="email"
              value={form.supportEmail}
              error={fieldErrors.supportEmail}
              onChange={(e) => updateField('supportEmail', e.target.value)}
            />
            <Button type="submit" loading={saving} className="w-full">
              Save store & generate link
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-white border-amber-200/60">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How it works</h2>
          <ol className="space-y-3 text-sm text-gray-600 list-decimal list-inside">
            <li>Enter your <strong>store name</strong> and contact details.</li>
            <li>Click save — your unique <strong>store link</strong> is created.</li>
            <li>Set your <strong>selling prices</strong> below (within admin min/max).</li>
            <li>Share your link — customers buy data from your branded store.</li>
          </ol>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-gold" />
        <h2 className="text-lg font-semibold text-white">Set your prices</h2>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Prices must stay between the admin base price and maximum selling price.
      </p>

      <div className="space-y-6">
        {Object.entries(grouped).map(([network, items]) => (
          <Card key={network} className="overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{network}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-white border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Bundle</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Min (Base)</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Max</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Your price</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pkg) => (
                    <tr key={pkg._id} className="border-b last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{pkg.bundleSize}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(pkg.resellerBasePrice)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(pkg.maxSellingPrice)}</td>
                      <td className="px-4 py-3">
                        {editingId === pkg._id ? (
                          <input
                            type="number"
                            step="0.01"
                            min={pkg.resellerBasePrice}
                            max={pkg.maxSellingPrice}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-emerald-700">{formatCurrency(pkg.myPrice)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === pkg._id ? (
                          <Button size="sm" loading={priceSaving} onClick={() => savePrice(pkg._id)}>Save</Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(pkg._id);
                              setEditPrice(String(pkg.myPrice));
                              setError('');
                              setSuccess('');
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
        ))}
      </div>
    </DashboardLayout>
  );
}
