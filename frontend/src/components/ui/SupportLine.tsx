import { Phone } from 'lucide-react';
import ContactHelpButton from '@/components/ui/ContactHelpButton';
import { ADMIN_SUPPORT_DISPLAY, ADMIN_SUPPORT_PHONE } from '@/lib/support-contact';

export default function SupportLine() {
  return (
    <ContactHelpButton
      phone={ADMIN_SUPPORT_PHONE}
      displayPhone={ADMIN_SUPPORT_DISPLAY}
      smsBody="Hi topdealsgh, I need support."
      whatsAppText="Hi topdealsgh, I need support."
      className="fixed bottom-5 left-3 sm:bottom-6 sm:left-6 z-50 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-navy-light/95 backdrop-blur-md border border-navy-border text-gray-300 shadow-lg shadow-black/20 hover:text-gold hover:border-gold/40 transition-all duration-200 safe-bottom"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gold/15 text-gold shrink-0">
        <Phone className="w-4 h-4" />
      </span>
      <span className="text-sm leading-tight hidden sm:block">
        <span className="block text-[11px] uppercase tracking-wide text-gray-500">Support line</span>
        <span className="font-semibold text-white whitespace-nowrap">{ADMIN_SUPPORT_DISPLAY}</span>
      </span>
    </ContactHelpButton>
  );
}
