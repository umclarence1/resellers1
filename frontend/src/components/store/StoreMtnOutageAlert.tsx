import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getNetworkImage } from '@/lib/network-images';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'topdealsgh-mtn-outage-alert-v1';
const WHATSAPP_UPDATES_URL = 'https://chat.whatsapp.com/KFJvUpZIEaxHWeOLbfgTR0';

/** Set to false when MTN maintenance is complete. */
export const MTN_OUTAGE_ALERT_ENABLED = true;

export default function StoreMtnOutageAlert() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!MTN_OUTAGE_ALERT_ENABLED) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const mtnImage = getNetworkImage('MTN');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mtn-outage-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close alert"
        onClick={dismiss}
      />

      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl shadow-black/40',
          'border border-amber-500/30 bg-white'
        )}
      >
        <div className="relative bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-4 pr-10">
            {mtnImage ? (
              <img
                src={mtnImage}
                alt="MTN"
                className="w-14 h-14 rounded-xl object-cover border-2 border-white/80 shadow-md shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/90 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
            )}
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-950/80">
                Service notice
              </p>
              <h2 id="mtn-outage-title" className="text-lg sm:text-xl font-bold text-amber-950 leading-tight">
                MTN Data Outage Alert
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 p-2 rounded-full bg-amber-950/10 text-amber-950 hover:bg-amber-950/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-4 text-gray-700 text-sm sm:text-[15px] leading-relaxed">
          <p>
            MTN services are currently unavailable due to ongoing maintenance on the{' '}
            <strong className="text-gray-900">MTN UP2U</strong> system.
          </p>
          <p>
            Services will be restored once MTN completes the maintenance process.
          </p>

          <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 text-blue-950 text-sm">
            <p className="font-medium text-blue-900 mb-1">Already placed an order?</p>
            <p>
              If you have paid for MTN data but have not received it yet, your order remains valid.
              Pending orders will be delivered automatically as soon as service is restored.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5">
            <p className="text-sm font-medium text-emerald-900 mb-2">Stay updated on WhatsApp</p>
            <a
              href={WHATSAPP_UPDATES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
            >
              Join our updates group
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
          </div>

          <p className="text-gray-500 text-sm pt-1">
            We sincerely apologize for the inconvenience and appreciate your patience and support.
          </p>
          <p className="text-gray-800 font-medium text-sm">— TopDealsGH Team</p>
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={dismiss}>
            Close
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            onClick={() => window.open(WHATSAPP_UPDATES_URL, '_blank', 'noopener,noreferrer')}
          >
            Join WhatsApp updates
          </Button>
        </div>
      </div>
    </div>
  );
}
