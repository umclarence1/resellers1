import { AlertTriangle, MessageCircle, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import {
  CONTACT_WARNING_MESSAGE,
  CONTACT_WARNING_TITLE,
  formatDisplayPhone,
  smsLink,
  whatsAppLink,
} from '@/lib/support-contact';

type ContactWarningModalProps = {
  open: boolean;
  onClose: () => void;
  phone: string;
  displayPhone?: string;
  smsBody?: string;
  whatsAppText?: string;
};

export default function ContactWarningModal({
  open,
  onClose,
  phone,
  displayPhone,
  smsBody,
  whatsAppText,
}: ContactWarningModalProps) {
  if (!open) return null;

  const label = displayPhone || formatDisplayPhone(phone);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-warning-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-4 pr-8">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div>
            <h2 id="contact-warning-title" className="text-lg font-bold text-gray-900">
              {CONTACT_WARNING_TITLE}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{CONTACT_WARNING_MESSAGE}</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Contact: <span className="font-semibold text-gray-900">{label}</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <a href={smsLink(phone, smsBody)} className="flex-1" onClick={onClose}>
            <Button type="button" className="w-full">
              Send SMS
            </Button>
          </a>
          <a
            href={whatsAppLink(phone, whatsAppText)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
            onClick={onClose}
          >
            <Button type="button" variant="secondary" className="w-full gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp text
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
