export const SUPPORT_KNOWLEDGE: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['how long', 'delivery', 'instant', 'minutes', 'when will'],
    answer:
      'Data bundles are usually delivered within a few minutes after payment is confirmed. During peak times it can take longer — wait at least 2 hours before reporting a missing bundle.',
  },
  {
    keywords: ['paystack', 'payment', 'pay', 'card', 'momo'],
    answer:
      'Purchases are paid securely through Paystack. After payment you will be redirected back to the store. If payment succeeded but data is missing, use “Check my orders” and report the order after 2 hours.',
  },
  {
    keywords: ['complaint', 'not received', 'missing', 'report'],
    answer:
      'You can report “Data not received” from 2 hours up to 24 hours after purchase — even if the order shows as delivered. Refunded or cancelled orders cannot be reported again.',
  },
  {
    keywords: ['mtn', 'telecel', 'airteltigo', 'network'],
    answer:
      'We support MTN, Telecel, and AirtelTigo bundles. Available networks depend on each store — check the store home page for live stock.',
  },
  {
    keywords: ['reseller', 'white-label', 'open store', 'sell data'],
    answer:
      'To open your own reseller store, tap “Become A Reseller” on the topdealsgh homepage, register, verify your email, then set up your store name and prices from your reseller dashboard.',
  },
  {
    keywords: ['become agent', 'want agent', 'join agent', 'agent account', 'sign up agent'],
    answer:
      'Agent accounts are created by the platform admin — there is no public agent sign-up. If you already have agent credentials, use Agent Login on the homepage. To sell through your own store instead, choose Become A Reseller.',
  },
  {
    keywords: ['agent login', 'agent api', 'bulk', 'developer'],
    answer:
      'Agents log in via Agent Login on the homepage. In the dashboard you can buy data in bulk, fund your wallet, and use the Developer API (API keys under Developer API). New agent accounts must be created by admin.',
  },
  {
    keywords: ['how buy', 'how purchase', 'how order', 'buy data'],
    answer:
      'On a store page, pick MTN/Telecel/AirtelTigo, choose a bundle, enter the recipient phone and your email, then pay with Paystack. Data is delivered automatically after payment.',
  },
  {
    keywords: ['support', 'contact', 'help', 'whatsapp', 'phone'],
    answer:
      'For platform support, use SMS or WhatsApp text only — we do not answer phone calls. Store-specific issues can also be routed through the store owner’s contact on their store page.',
  },
  {
    keywords: ['otp', 'code', 'verify', 'email'],
    answer:
      'To protect your privacy, order history requires a 6-digit code sent to your email. Enter the email or phone you used when buying — if we find orders, we send the code to your email on file.',
  },
];

export function matchKnowledge(message: string): string | null {
  const lower = message.toLowerCase().replace(/\bgent\b/g, 'agent');
  let best: { score: number; answer: string } | null = null;
  for (const entry of SUPPORT_KNOWLEDGE) {
    const hits = entry.keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0 && (!best || hits > best.score)) {
      best = { score: hits, answer: entry.answer };
    }
  }
  return best?.answer ?? null;
}

export const GREETING =
  'Hi! I’m the topdealsgh assistant. Ask about buying data, delivery times, becoming a reseller or agent, or track orders and report missing data.';

export const QUICK_ACTIONS = {
  home: [
    { id: 'track_order', label: 'Track my order' },
    { id: 'how_buy', label: 'How to buy data' },
    { id: 'become_reseller', label: 'Become a reseller' },
    { id: 'become_agent', label: 'Become an agent' },
    { id: 'faq_delivery', label: 'Delivery time' },
  ],
  store: [
    { id: 'check_orders', label: 'Check my orders' },
    { id: 'not_received', label: 'Data not received' },
    { id: 'how_buy', label: 'How to buy' },
    { id: 'faq_delivery', label: 'Delivery time' },
  ],
  dashboard: {
    admin: [
      { id: 'admin_search', label: 'Open admin search' },
      { id: 'admin_complaints', label: 'View complaints' },
      { id: 'faq_delivery', label: 'Complaint rules' },
    ],
    agent: [
      { id: 'agent_orders', label: 'Recent orders' },
      { id: 'agent_wallet', label: 'Wallet balance' },
      { id: 'agent_api', label: 'API help' },
    ],
    reseller: [
      { id: 'reseller_orders', label: 'Store orders' },
      { id: 'reseller_complaints', label: 'Complaints page' },
      { id: 'faq_delivery', label: 'Complaint rules' },
    ],
  },
} as const;
