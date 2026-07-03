import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, X, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getNetworkImage } from '@/lib/network-images';
import { cn } from '@/lib/utils';
import { normalizeWhatsAppChannelUrl, isValidWhatsAppChannelUrl } from '@/lib/whatsapp-channel';

/** Set to false when all networks are back to normal. */
export const MTN_OUTAGE_ALERT_ENABLED = true;

type ServiceStatus = 'available' | 'unavailable';

type ServiceStatusRow = {
  id: string;
  label: string;
  network?: 'MTN' | 'Telecel' | 'AirtelTigo';
  status: ServiceStatus;
  note?: string;
};

const SERVICE_STATUS_ROWS: ServiceStatusRow[] = [
  { id: 'telecel', label: 'Telecel', network: 'Telecel', status: 'available' },
  { id: 'airteltigo', label: 'AirtelTigo', network: 'AirtelTigo', status: 'available' },
  {
    id: 'mtn-afa',
    label: 'MTN AFA registration',
    network: 'MTN',
    status: 'unavailable',
    note: 'Registration is temporarily unavailable.',
  },
  {
    id: 'mtn',
    label: 'MTN',
    network: 'MTN',
    status: 'unavailable',
    note: 'Unavailable due to ongoing MTN UP2U maintenance.',
  },
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

function StatusRow({ row }: { row: ServiceStatusRow }) {
  const available = row.status === 'available';
  const image = row.network ? getNetworkImage(row.network) : undefined;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3.5 py-3',
        available ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/70'
      )}
    >
      {image ? (
        <img src={image} alt={row.label} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white shadow-sm" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900 text-sm">{row.label}</p>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              available ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            )}
          >
            {available ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {available ? 'Available' : 'Not available'}
          </span>
        </div>
        {row.note && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{row.note}</p>}
      </div>
    </div>
  );
}

export default function StoreMtnOutageAlert({ slug, whatsappChannelUrl, storeName }: StoreMtnOutageAlertProps) {
  const [open, setOpen] = useState(false);
  const channelHref = resellerChannelHref(whatsappChannelUrl);
  const storageKey = `topdealsgh-service-status-alert-v3-${slug || 'store'}`;
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
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

      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl shadow-black/40',
          'border border-navy/10 bg-white'
        )}
      >
        <div className="relative bg-gradient-to-r from-navy via-navy-light to-navy px-5 py-4 sm:px-6">
          <div className="flex items-start gap-4 pr-10">
            <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7 text-amber-300" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold/90">
                Service notice
              </p>
              <h2 id="service-status-title" className="text-lg sm:text-xl font-bold text-white leading-tight">
                Network Service Status
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-4 text-gray-700 text-sm sm:text-[15px] leading-relaxed">
          <p className="text-gray-600">
            Please check the current availability below before placing your order.
          </p>

          <div className="space-y-2.5">
            {SERVICE_STATUS_ROWS.map((row) => (
              <StatusRow key={row.id} row={row} />
            ))}
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 text-blue-950 text-sm">
            <p className="font-medium text-blue-900 mb-1">Already placed an MTN order?</p>
            <p>
              If you have paid for MTN data but have not received it yet, your order remains valid.
              Pending orders will be delivered automatically as soon as service is restored.
            </p>
          </div>

          {channelHref && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5">
              <p className="text-sm font-medium text-emerald-900 mb-2">Stay updated on WhatsApp</p>
              <a
                href={channelHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
              >
                {updatesLabel}
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>
            </div>
          )}

          <p className="text-gray-500 text-sm pt-1">
            We sincerely apologize for the inconvenience and appreciate your patience and support.
          </p>
          {storeName && <p className="text-gray-800 font-medium text-sm">— {storeName}</p>}
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={dismiss}>
            Close
          </Button>
          {channelHref && (
            <Button
              type="button"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              onClick={() => window.open(channelHref, '_blank', 'noopener,noreferrer')}
            >
              {updatesLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
