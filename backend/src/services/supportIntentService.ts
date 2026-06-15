import { matchKnowledge } from './supportKnowledge';

export type IntentContext = {
  page: 'home' | 'store' | 'dashboard';
  storeSlug?: string;
  role?: 'admin' | 'agent' | 'reseller' | null;
};

export type IntentAction =
  | 'track_order'
  | 'check_orders'
  | 'not_received'
  | 'how_buy'
  | 'become_reseller'
  | 'become_agent'
  | 'faq_delivery'
  | 'contact_support'
  | 'menu'
  | 'use_email'
  | 'use_phone';

export type DetectedIntent =
  | { kind: 'action'; action: IntentAction }
  | { kind: 'topic'; answer: string }
  | null;

/** Normalize common typos (e.g. GENT → agent). */
export function normalizeUserText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bgent\b/g, 'agent')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeStoreSlug(text: string): boolean {
  const slug = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (slug.length < 3 || slug.length > 40) return false;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return false;
  const blocked = ['iwant', 'become', 'agent', 'reseller', 'help', 'order', 'track', 'buy'];
  if (blocked.some((w) => slug.includes(w))) return false;
  return true;
}

export function detectIntent(text: string, ctx: IntentContext): DetectedIntent {
  const lower = normalizeUserText(text);
  if (!lower) return null;

  if (/^(cancel|stop|back|start over|menu|restart|never mind|nevermind)$/.test(lower)) {
    return { kind: 'action', action: 'menu' };
  }

  if (
    /^(hi|hello|hey|help|good morning|good afternoon|good evening)$/.test(lower) ||
    /^help me/.test(lower)
  ) {
    return { kind: 'action', action: 'menu' };
  }

  if (/become.*agent|want.*agent|join.*agent|sign up.*agent|agent account|how.*agent/.test(lower) || lower === 'agent') {
    return { kind: 'action', action: 'become_agent' };
  }

  if (/become.*resell|want.*resell|reseller account|own store|sell data|white.?label|open store/.test(lower) || lower === 'reseller') {
    return { kind: 'action', action: 'become_reseller' };
  }

  if (/how.*buy|how.*purchase|how.*order|buy data|purchase data|get data|where.*buy/.test(lower)) {
    return { kind: 'action', action: 'how_buy' };
  }

  if (/delivery|how long|when will|instant|minutes|deliver/.test(lower)) {
    return { kind: 'action', action: 'faq_delivery' };
  }

  if (/not received|missing data|didn't receive|didnt receive|no data|complaint|report order/.test(lower)) {
    return { kind: 'action', action: 'not_received' };
  }

  if (/track.*order|check.*order|my order|order history|find order|where.*order|status.*order/.test(lower) || lower === 'orders') {
    return { kind: 'action', action: 'track_order' };
  }

  if (/paystack|payment|pay with|momo|mobile money|card pay/.test(lower)) {
    const answer = matchKnowledge('paystack');
    if (answer) return { kind: 'topic', answer };
  }

  if (/mtn|telecel|airteltigo|network|bundle/.test(lower)) {
    const answer = matchKnowledge('network');
    if (answer) return { kind: 'topic', answer };
  }

  if (/support|contact|whatsapp|call|phone number|reach/.test(lower)) {
    return { kind: 'action', action: 'contact_support' };
  }

  if (/^email$|use email|with email|by email/.test(lower)) {
    return { kind: 'action', action: 'use_email' };
  }

  if (/^phone$|use phone|phone number|with phone|by phone|mobile number/.test(lower)) {
    return { kind: 'action', action: 'use_phone' };
  }

  if (/agent login|log in.*agent|login.*agent|api|bulk purchase|developer/.test(lower)) {
    const answer = matchKnowledge('agent');
    if (answer) return { kind: 'topic', answer };
  }

  const knowledge = matchKnowledge(lower);
  if (knowledge) return { kind: 'topic', answer: knowledge };

  return null;
}

export function isOtpCode(text: string): boolean {
  return /^\d{6}$/.test(text.trim());
}
