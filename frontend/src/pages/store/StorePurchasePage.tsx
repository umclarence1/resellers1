import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StoreLayout from '@/components/store/StoreLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';
import { StoreTab } from '@/components/store/StoreLayout';
import { runValidators, v } from '@/lib/form-validation';
import { redirectToPaystack } from '@/lib/paystack';

export default function StorePurchasePage() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug as string;
  const network = decodeURIComponent(params.network as string);

  const handleTabChange = (tab: StoreTab) => {
    navigate(`/store/${slug}`, { state: { tab } });
  };

  const [store, setStore] = useState<Record<string, string> | null>(null);
  const [packages, setPackages] = useState<Array<Record<string, unknown>>>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [packageId, setPackageId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/store/${slug}`).then((res) => setStore(res.data.data));
    api.get(`/store/${slug}/packages/${encodeURIComponent(network)}`).then((res) => {
      setPackages(res.data.data.packages);
      setPriceRange(res.data.data.priceRange);
    });
  }, [slug, network]);

  const selected = packages.find((p) => p.id === packageId);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = runValidators(
      { packageId, phone, email },
      {
        packageId: [v.required('Bundle')],
        phone: [v.required('Recipient number'), v.phone],
        email: [v.required('Email'), v.email],
      }
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      const res = await api.post(`/store/${slug}/purchase/init`, { packageId, recipientPhone: phone, email });
      redirectToPaystack(res.data.data.authorizationUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
  };

  if (!store) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <StoreLayout
      store={store as { storeName: string; slug: string; phone: string; whatsapp: string; supportEmail: string }}
      activeTab="services"
      onTabChange={handleTabChange}
    >
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Card className="p-4 sm:p-6">
          {/* Network header */}
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{network}</h1>
            <p className="text-gray-500 mt-1">
              {formatCurrency(priceRange.min)} - {formatCurrency(priceRange.max)}
            </p>
          </div>

          <form noValidate onSubmit={handlePurchase} className="space-y-4">
            <Select
              label="Select Bundle"
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                if (fieldErrors.packageId) setFieldErrors((prev) => ({ ...prev, packageId: '' }));
              }}
              options={[
                { value: '', label: 'Choose a bundle...' },
                ...packages.map((p) => ({
                  value: p.id as string,
                  label: p.bundleSize as string,
                })),
              ]}
            />
            {fieldErrors.packageId && (
              <p className="text-sm text-red-600 -mt-2">{fieldErrors.packageId}</p>
            )}

            {selected && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-1">
                <p className="text-sm text-gray-600">Selected: <strong>{selected.bundleSize as string}</strong></p>
                <p className="text-lg font-bold text-blue-700">Price: {formatCurrency(selected.price as number)}</p>
              </div>
            )}

            <Input
              label="Recipient Number"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="0XXXXXXXXX"
              inputMode="numeric"
              maxLength={10}
              error={fieldErrors.phone}
            />
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              error={fieldErrors.email}
            />

            <Button
              type="submit"
              loading={loading}
              disabled={!packageId || !phone || !email}
              className="w-full"
              size="lg"
            >
              Proceed To Payment
            </Button>
          </form>
        </Card>
      </div>
    </StoreLayout>
  );
}
