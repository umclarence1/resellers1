export const ADMIN_SUPPORT_PHONE = '+233595399837';
export const ADMIN_SUPPORT_DISPLAY = '+233 59 539 9837';

export const CONTACT_WARNING_TITLE = 'Please do not call';
export const CONTACT_WARNING_MESSAGE =
  'We do not answer phone calls. Please contact us by SMS or WhatsApp text only.';

export function normalizeGhanaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return `233${digits.slice(1)}`;
  return digits;
}

export function formatDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

export function smsLink(phone: string, body?: string): string {
  const n = normalizeGhanaPhone(phone);
  const base = `sms:+${n}`;
  return body ? `${base}?body=${encodeURIComponent(body)}` : base;
}

export function whatsAppLink(phone: string, text?: string): string {
  const n = normalizeGhanaPhone(phone);
  const base = `https://wa.me/${n}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
