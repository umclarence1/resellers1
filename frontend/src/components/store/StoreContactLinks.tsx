import { MessageCircle, Phone } from 'lucide-react';
import ContactHelpButton from '@/components/ui/ContactHelpButton';
import { formatDisplayPhone, whatsAppLink } from '@/lib/support-contact';

type StoreContactLinksProps = {
  phone: string;
  whatsapp: string;
  storeName?: string;
  layout?: 'inline' | 'stacked' | 'footer';
};

export default function StoreContactLinks({
  phone,
  whatsapp,
  storeName,
  layout = 'inline',
}: StoreContactLinksProps) {
  const waPhone = whatsapp || phone;
  const greeting = storeName ? `Hi ${storeName}, I need help with my order.` : 'Hi, I need help with my order.';
  const display = formatDisplayPhone(phone);

  if (layout === 'footer') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <ContactHelpButton
          phone={phone}
          displayPhone={display}
          smsBody={greeting}
          whatsAppText={greeting}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold transition"
        >
          <Phone className="w-4 h-4 text-gold" />
          Support: {display}
        </ContactHelpButton>
        {waPhone && (
          <a
            href={whatsAppLink(waPhone, greeting)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#25D366] hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp text
          </a>
        )}
      </div>
    );
  }

  if (layout === 'stacked') {
    return (
      <div className="flex flex-col items-center gap-3">
        <ContactHelpButton
          phone={phone}
          displayPhone={display}
          smsBody={greeting}
          whatsAppText={greeting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold text-navy font-semibold hover:bg-gold-hover transition"
        >
          <Phone className="w-4 h-4" />
          Message {display}
        </ContactHelpButton>
        {waPhone && (
          <a
            href={whatsAppLink(waPhone, greeting)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-[#25D366] text-[#25D366] font-semibold hover:bg-[#25D366]/10 transition"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp text
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ContactHelpButton
        phone={phone}
        displayPhone={display}
        smsBody={greeting}
        whatsAppText={greeting}
        className="text-gold font-medium hover:underline"
      >
        {display}
      </ContactHelpButton>
      {waPhone && (
        <a
          href={whatsAppLink(waPhone, greeting)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#25D366] font-medium hover:underline inline-flex items-center gap-1"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
