const WHATSAPP_CHANNEL_HOSTS = new Set(['whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com']);

export function normalizeWhatsAppChannelUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (!WHATSAPP_CHANNEL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Invalid WhatsApp channel or community link');
  }
  const path = url.pathname.toLowerCase();
  const isChannel = path.includes('/channel/');
  const isCommunity = path.includes('/community/') || url.hostname === 'chat.whatsapp.com';
  if (!isChannel && !isCommunity) {
    throw new Error('Link must be a WhatsApp channel or community invite URL');
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

export function parseOptionalWhatsAppChannelUrl(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).trim();
  if (!value) return '';
  return normalizeWhatsAppChannelUrl(value);
}
