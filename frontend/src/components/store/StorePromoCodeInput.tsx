import { useState } from 'react';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';

export type PromoPreview = {
  originalSellingPrice: number;
  discountedSellingPrice: number;
  discountGhs: number;
  processingFee: number;
  total: number;
};

type Props = {
  slug: string;
  packageId?: string;
  disabled?: boolean;
  onApplied: (code: string, preview: PromoPreview | null) => void;
};

export default function StorePromoCodeInput({ slug, packageId, disabled, onApplied }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [appliedCode, setAppliedCode] = useState('');

  const handleApply = async () => {
    if (!packageId || !code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/store/${slug}/promo/validate`, {
        code: code.trim(),
        packageId,
      });
      const data = res.data.data as PromoPreview;
      setPreview(data);
      setAppliedCode(code.trim().toUpperCase());
      onApplied(code.trim().toUpperCase(), data);
    } catch (err) {
      setPreview(null);
      setAppliedCode('');
      onApplied('', null);
      setError(err instanceof Error ? err.message : 'Invalid promo code');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setCode('');
    setPreview(null);
    setAppliedCode('');
    setError('');
    onApplied('', null);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          label="Promo code (optional)"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError('');
          }}
          placeholder="TD-XXXXXXXX"
          error={error}
          disabled={disabled || !packageId || !!appliedCode}
          className="flex-1"
        />
        {appliedCode ? (
          <Button type="button" variant="outline" onClick={handleClear} className="mt-6 shrink-0">
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleApply}
            loading={loading}
            disabled={disabled || !packageId || !code.trim()}
            className="mt-6 shrink-0"
          >
            Apply
          </Button>
        )}
      </div>

      {preview && appliedCode && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
          <p className="font-medium text-emerald-800">Promo applied: {appliedCode}</p>
          <div className="flex justify-between text-gray-600">
            <span>Original</span>
            <span className="line-through">{formatCurrency(preview.originalSellingPrice)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Discount</span>
            <span>-{formatCurrency(preview.discountGhs)}</span>
          </div>
          {preview.processingFee > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Paystack fee</span>
              <span>{formatCurrency(preview.processingFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-emerald-200">
            <span>Total</span>
            <span>{formatCurrency(preview.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
