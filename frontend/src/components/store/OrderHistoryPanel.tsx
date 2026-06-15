import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import OtpInput from '@/components/ui/OtpInput';
import { cn } from '@/lib/utils';
import { runValidators, v } from '@/lib/form-validation';
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Mail,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface OrderRow {
  orderId: string;
  network: string;
  bundleSize: string;
  recipientPhone: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  delivered: {
    label: 'Delivered',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  processing: {
    label: 'Processing',
    className: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: Loader2,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    icon: RefreshCw,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    icon: XCircle,
  },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);

type Step = 'identify' | 'verify' | 'orders';

export default function OrderHistoryPanel({ slug, storeName }: { slug: string; storeName: string }) {
  const [step, setStep] = useState<Step>('identify');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [orderCount, setOrderCount] = useState(0);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const verifyingRef = useRef(false);
  const otpWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'verify') {
      const timer = setTimeout(() => {
        otpWrapRef.current?.querySelector('input')?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const resetFlow = () => {
    setStep('identify');
    setEmail('');
    setMaskedEmail('');
    setOrderCount(0);
    setOtp(['', '', '', '', '', '']);
    setOrders([]);
    setError('');
    setResendMessage('');
    setResendCooldown(0);
    verifyingRef.current = false;
  };

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = runValidators(
      { email },
      { email: [v.required('Email'), v.email] }
    );
    if (Object.keys(errors).length) {
      setError(errors.email);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/store/${slug}/history/request`, { email: email.trim() });
      setMaskedEmail(data.data.maskedEmail);
      setOrderCount(data.data.orderCount);
      setStep('verify');
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = useCallback(
    async (code: string) => {
      if (code.length !== 6 || verifyingRef.current) return;
      verifyingRef.current = true;
      setError('');
      setLoading(true);
      try {
        const { data } = await api.post(`/store/${slug}/history/verify`, {
          email: email.trim(),
          code,
        });
        setOrders(data.data.orders);
        setStep('orders');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setOtp(['', '', '', '', '', '']);
        verifyingRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [email, slug]
  );

  const resendCode = async () => {
    if (resending || resendCooldown > 0 || loading) return;
    setResending(true);
    setError('');
    setResendMessage('');
    verifyingRef.current = false;
    try {
      await api.post(`/store/${slug}/history/request`, { email: email.trim() });
      setResendMessage('A new code has been sent. Check your inbox and spam folder.');
      setResendCooldown(30);
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const active = orders.filter((o) => ['pending', 'processing'].includes(o.status)).length;

  return (
    <section className="py-12 sm:py-16 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 mb-4">
            <History className="w-7 h-7 text-gold" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Check Order History</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
            Enter the email you used when buying data. We&apos;ll send a 6-digit code to verify it&apos;s you.
          </p>
        </div>

        {step === 'identify' && (
          <form
            onSubmit={requestCode}
            className="bg-gradient-to-b from-navy-card/90 to-navy-light/80 backdrop-blur-md border border-navy-border rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/20"
          >
            <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
            <div className="relative mb-4">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="you@email.com"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-navy border border-navy-border text-white placeholder:text-gray-500 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40 transition"
                autoComplete="email"
              />
            </div>
            <p className="text-xs text-gray-500 mb-6 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              Your verification code will be sent to this email if you have orders at {storeName}.
            </p>
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending code...
                </span>
              ) : (
                'Send verification code'
              )}
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <div className="bg-gradient-to-b from-white to-gray-50 border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/25">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                {orderCount} order{orderCount !== 1 ? 's' : ''} found
              </div>
              <p className="text-gray-600 text-sm">Enter the 6-digit code sent to</p>
              <p className="text-navy font-semibold text-lg mt-1">{maskedEmail}</p>
            </div>

            <div ref={otpWrapRef}>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} onComplete={verifyCode} />
            </div>

            {loading && (
              <p className="text-sm text-amber-700 mt-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying your code...
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-4 text-center">{error}</p>
            )}
            {resendMessage && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mt-4 text-center">
                {resendMessage}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 text-sm">
              <button
                type="button"
                onClick={resendCode}
                disabled={loading || resending || resendCooldown > 0}
                className="text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
              >
                {resending
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : 'Resend code'}
              </button>
              <span className="hidden sm:inline text-gray-300">|</span>
              <button
                type="button"
                onClick={resetFlow}
                disabled={loading}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {step === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3">
              {[
                { label: 'Total orders', value: orders.length, color: 'from-gold/20 to-gold/5 text-gold' },
                { label: 'Delivered', value: delivered, color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400' },
                { label: 'Active', value: active, color: 'from-sky-500/20 to-sky-500/5 text-sky-400' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    'rounded-2xl border border-navy-border bg-gradient-to-br p-4 text-center',
                    stat.color.split(' ').slice(0, 2).join(' ')
                  )}
                >
                  <p className={cn('text-2xl font-bold', stat.color.split(' ')[2])}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Lifetime orders</h3>
              <button
                type="button"
                onClick={resetFlow}
                className="text-sm text-gold hover:text-gold-hover transition"
              >
                Check another
              </button>
            </div>

            {orders.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No orders to display.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => {
                  const status = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                  const StatusIcon = status.icon;
                  return (
                    <li
                      key={order.orderId}
                      className="bg-navy-card/70 backdrop-blur-sm border border-navy-border rounded-2xl p-4 sm:p-5 hover:border-gold/25 transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gold" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {order.network} · {order.bundleSize}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">{order.orderId}</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                            status.className
                          )}
                        >
                          <StatusIcon className={cn('w-3.5 h-3.5', order.status === 'processing' && 'animate-spin')} />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gold/70" />
                          {order.recipientPhone}
                        </span>
                        <span className="text-gold font-medium">{formatMoney(order.totalAmount)}</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
