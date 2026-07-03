import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { normalizeWhatsAppChannelUrl, isValidWhatsAppChannelUrl } from '@/lib/whatsapp-channel';

/** Set to false when all services are back to normal. */
export const MTN_OUTAGE_ALERT_ENABLED = true;

type ServiceStatus = 'available' | 'unavailable';

const SERVICE_STATUS_ROWS: { label: string; status: ServiceStatus }[] = [
  { label: 'Telecel', status: 'available' },
  { label: 'AirtelTigo', status: 'available' },
  { label: 'MTN', status: 'unavailable' },
  { label: 'MTN AFA registration', status: 'available' },
  { label: 'Results checkers', status: 'unavailable' },
];

type StoreMtnOutageAlertProps = {
  slug: string;
  whatsappChannelUrl?: string;
  storeName?: string;
};

function resellerChannelHref(whatsappChannelUrl?: string): string | null {
  const raw = whatsappChannelUrl?.trim();
  if (!raw || !isValidWhatsAppChannelUrl(raw)) return null;
  try {
    return normalizeWhatsAppChannelUrl(raw);
  } catch {
    return null;
  }
}

export default function StoreMtnOutageAlert({ slug, whatsappChannelUrl, storeName }: StoreMtnOutageAlertProps) {
  const [open, setOpen] = useState(false);
  const channelHref = resellerChannelHref(whatsappChannelUrl);
  const storageKey = `topdealsgh-service-status-alert-v4-${slug || 'store'}`;
  const updatesLabel = storeName ? `Join ${storeName} on WhatsApp` : 'Join WhatsApp updates';

  useEffect(() => {
    if (!MTN_OUTAGE_ALERT_ENABLED) return;
    try {
      if (sessionStorage.getItem(storageKey) === '1') return;
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, '1');
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-status-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label="Close alert"
        onClick={dismiss}
      />

      <div className="relative w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border border-navy/10 bg-white">
        <div className="flex items-center justify-between gap-3 bg-navy px-4 py-3 pr-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
            <h2 id="service-status-title" className="text-sm font-bold text-white truncate">
              Service Status
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-full text-white/80 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 text-sm">
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
            {SERVICE_STATUS_ROWS.map((row) => {
              const available = row.status === 'available';
              return (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white"
                >
                  <span className="text-gray-800 font-medium">{row.label}</span>
                  <span
                    className={cn(
                      'text-[11px] font-semibold uppercase shrink-0',
                      available ? 'text-emerald-600' : 'text-amber-700'
                    )}
                  >
                    {available ? 'Available' : 'Not available'}
                  </span>
                </li>
              );
            })}
          </ul>

          {channelHref && (
            <a
              href={channelHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
            >
              {updatesLabel}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={dismiss}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
