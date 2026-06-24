import { whatsAppLink } from '@/lib/support-contact';

const WHATSAPP_CHANNEL_HOSTS = new Set(['whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com']);

export function normalizeWhatsAppChannelUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error('Enter a valid WhatsApp channel or community link');
  }
  if (!WHATSAPP_CHANNEL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Link must be from whatsapp.com or chat.whatsapp.com');
  }
  const path = url.pathname.toLowerCase();
  const isChannel = path.includes('/channel/');
  const isCommunity = path.includes('/community/') || url.hostname === 'chat.whatsapp.com';
  if (!isChannel && !isCommunity) {
    throw new Error('Use a WhatsApp channel or community invite link');
  }
  return url.toString();
}

export function isValidWhatsAppChannelUrl(raw: string): boolean {
  if (!raw?.trim()) return true;
  try {
    normalizeWhatsAppChannelUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/** Prefer channel/community link for store WhatsApp buttons; fall back to direct chat. */
export function resolveStoreWhatsAppHref(input: {
  whatsappChannelUrl?: string;
  whatsapp?: string;
  phone?: string;
  message?: string;
}): string | null {
  const channel = input.whatsappChannelUrl?.trim();
  if (channel) {
    try {
      return normalizeWhatsAppChannelUrl(channel);
    } catch {
      return channel;
    }
  }
  const phone = input.whatsapp?.trim() || input.phone?.trim();
  if (!phone) return null;
  return whatsAppLink(phone, input.message);
}
