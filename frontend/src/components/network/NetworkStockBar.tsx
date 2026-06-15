import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';

export type NetworkStockRow = {
  network: string;
  inStock: boolean;
  imageUrl?: string;
};

type NetworkStockBarProps = {
  stock: NetworkStockRow[];
  onToggle?: (network: string, inStock: boolean) => void;
  togglingNetwork?: string | null;
  readOnly?: boolean;
  className?: string;
};

export default function NetworkStockBar({
  stock,
  onToggle,
  togglingNetwork,
  readOnly = false,
  className,
}: NetworkStockBarProps) {
  if (stock.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!readOnly && (
        <p className="text-xs text-gray-400">
          Toggle network availability for agents, resellers, and customer stores.
        </p>
      )}
      {readOnly && (
        <p className="text-xs text-gray-400">
          Networks marked out of stock cannot be purchased until restocked by admin.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {stock.map((row) => {
          const busy = togglingNetwork === row.network;
          return (
            <div
              key={row.network}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white min-w-[200px]',
                row.inStock ? 'border-emerald-200/80' : 'border-amber-200/80'
              )}
            >
              {row.imageUrl ? (
                <img
                  src={row.imageUrl}
                  alt={row.network}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{row.network}</p>
                <p
                  className={cn(
                    'text-xs font-medium',
                    row.inStock ? 'text-emerald-600' : 'text-amber-700'
                  )}
                >
                  {row.inStock ? 'In stock' : 'Out of stock'}
                </p>
              </div>
              {!readOnly && onToggle ? (
                <Button
                  size="sm"
                  variant={row.inStock ? 'outline' : 'primary'}
                  disabled={busy}
                  onClick={() => onToggle(row.network, !row.inStock)}
                  className="shrink-0 text-xs whitespace-nowrap"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : row.inStock ? (
                    'Out of stock'
                  ) : (
                    'In stock'
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
