import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { X, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingStep = {
  step: string;
  label: string;
  message: string;
  done: boolean;
  at: string;
};

type TrackingData = {
  orderId: string;
  status: string;
  providerStatus?: string;
  providerReference?: string;
  recipientPhone: string;
  network: string;
  bundleSize: string;
  sellingPrice?: number;
  totalAmount?: number;
  steps: TrackingStep[];
};

export default function OrderTrackingModal({
  orderId,
  role,
  onClose,
}: {
  orderId: string;
  role: 'agent' | 'reseller' | 'admin';
  onClose: () => void;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/${role}/orders/${orderId}/tracking`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load tracking'))
      .finally(() => setLoading(false));
  }, [orderId, role]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-navy-card border border-navy-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 py-5 border-b border-navy-border">
          <div>
            <h2 className="text-xl font-bold italic text-white">Track Delivery</h2>
            <p className="text-sm text-sky-400 font-mono mt-1">ORDER: {orderId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading tracker...
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 py-8 text-center">{error}</p>
          ) : data ? (
            <>
              <div className="space-y-0">
                {data.steps.map((step, index) => {
                  const isLast = index === data.steps.length - 1;
                  const inProgress = !step.done && index > 0 && data.steps[index - 1]?.done;
                  return (
                    <div key={step.step} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                            step.done
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : inProgress
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-navy-light text-gray-500'
                          )}
                        >
                          {step.done ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </div>
                        {!isLast && <div className="w-px flex-1 min-h-[2rem] bg-navy-border my-1" />}
                      </div>
                      <div className="pb-6 min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold tracking-wider text-gray-200 uppercase">
                            {step.label}
                          </p>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase shrink-0',
                              step.done
                                ? 'text-emerald-400'
                                : inProgress
                                  ? 'text-sky-400'
                                  : 'text-gray-500'
                            )}
                          >
                            {step.done ? 'Completed' : inProgress ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{step.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 rounded-xl bg-navy-light/80 border border-navy-border p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Recipient Network</span>
                  <span className="text-white font-medium">{data.network}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Package</span>
                  <span className="text-white font-medium">
                    {data.network} {data.bundleSize}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Phone Number</span>
                  <span className="text-white font-medium">{data.recipientPhone}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Amount Charged</span>
                  <span className="text-white font-medium">
                    {formatCurrency(data.totalAmount ?? data.sellingPrice ?? 0)}
                  </span>
                </div>
                {role === 'admin' && data.providerReference && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">API Reference</span>
                    <span className="text-sky-300 font-mono text-xs break-all text-right">
                      {data.providerReference}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-navy-border">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
}
