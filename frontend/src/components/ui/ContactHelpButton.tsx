import { useState, type CSSProperties, type ReactNode } from 'react';
import ContactWarningModal from '@/components/ui/ContactWarningModal';

type ContactHelpButtonProps = {
  phone: string;
  displayPhone?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  smsBody?: string;
  whatsAppText?: string;
};

export default function ContactHelpButton({
  phone,
  displayPhone,
  children,
  className,
  style,
  smsBody,
  whatsAppText,
}: ContactHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        {children}
      </button>
      <ContactWarningModal
        open={open}
        onClose={() => setOpen(false)}
        phone={phone}
        displayPhone={displayPhone}
        smsBody={smsBody}
        whatsAppText={whatsAppText}
      />
    </>
  );
}
