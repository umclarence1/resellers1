import { Faq } from '../models/Faq';
import { Order } from '../models/Order';
import { Wallet } from '../models/Wallet';
import { Complaint } from '../models/Complaint';
import { CustomerComplaint } from '../models/CustomerComplaint';
import { AppError } from '../middleware/errorHandler';
import {
  requestOrderHistoryOtp,
  requestOrderHistoryOtpByPhone,
  verifyOrderHistoryOtp,
  verifyOrderHistoryOtpByPhone,
  getVerifiedStoreOrders,
  getOrderStoreSlug,
  PLATFORM_ORDER_SCOPE,
  type OrderHistoryRow,
} from './orderHistoryService';
import { verifySupportSession } from './supportSessionService';
import {
  createCustomerComplaint,
  canSubmitCustomerComplaint,
} from './customerComplaintService';
import { GREETING, QUICK_ACTIONS, matchKnowledge } from './supportKnowledge';
import { detectIntent, isOtpCode, type DetectedIntent } from './supportIntentService';
import { assertGhanaPhone } from '../utils/phone';

export type AssistantPage = 'home' | 'store' | 'dashboard';

export type AssistantContext = {
  page: AssistantPage;
  storeSlug?: string;
  role?: 'admin' | 'agent' | 'reseller' | null;
  userId?: string;
};

export type AssistantSessionState = {
  step:
    | 'idle'
    | 'await_identifier_type'
    | 'await_email'
    | 'await_phone'
    | 'await_otp'
    | 'show_orders'
    | 'await_order_pick'
    | 'confirm_complaint';
  storeSlug?: string;
  identifierType?: 'email' | 'phone';
  pendingIdentifier?: string;
  selectedOrderId?: string;
};

export type AssistantAction = { id: string; label: string };

export type AssistantChatResult = {
  replies: string[];
  actions: AssistantAction[];
  orders?: OrderHistoryRow[];
  session: AssistantSessionState;
  sessionToken?: string;
};

function menuResult(ctx: AssistantContext): AssistantChatResult {
  return {
    replies: [GREETING],
    actions: actionsForContext(ctx),
    session: { step: 'idle' },
  };
}

function orderLookupScope(_ctx: AssistantContext, session: AssistantSessionState): string {
  return session.storeSlug || PLATFORM_ORDER_SCOPE;
}

async function startOrderLookup(
  ctx: AssistantContext,
  session: AssistantSessionState,
  intro: string[]
): Promise<AssistantChatResult> {
  const next: AssistantSessionState = {
    ...session,
    step: 'await_identifier_type',
    storeSlug: PLATFORM_ORDER_SCOPE,
  };
  return {
    replies: intro,
    actions: [
      { id: 'use_email', label: 'Use email' },
      { id: 'use_phone', label: 'Use phone number' },
      { id: 'menu', label: 'Menu' },
    ],
    session: next,
  };
}

function actionsForContext(ctx: AssistantContext): AssistantAction[] {
  if (ctx.page === 'home') {
    return [...QUICK_ACTIONS.home];
  }
  if (ctx.page === 'store') {
    return [...QUICK_ACTIONS.store];
  }
  if (ctx.role === 'admin') return [...QUICK_ACTIONS.dashboard.admin];
  if (ctx.role === 'agent') return [...QUICK_ACTIONS.dashboard.agent];
  if (ctx.role === 'reseller') return [...QUICK_ACTIONS.dashboard.reseller];
  return [{ id: 'faq_delivery', label: 'Help' }];
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function searchFaqs(message: string): Promise<string | null> {
  const faqs = await Faq.find({ isActive: true }).sort({ sortOrder: 1 });
  const lower = message.toLowerCase();
  for (const faq of faqs) {
    if (
      faq.question.toLowerCase().includes(lower) ||
      lower.split(/\s+/).some((w) => w.length > 3 && faq.question.toLowerCase().includes(w))
    ) {
      return faq.answer;
    }
  }
  return null;
}

function formatOrderLine(o: OrderHistoryRow): string {
  const date = new Date(o.createdAt).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${o.orderId} · ${o.network} ${o.bundleSize} · ${o.recipientPhone} · ${o.status} · GHS ${o.totalAmount.toFixed(2)} · ${date}`;
}

async function loadAuthenticatedOrders(
  ctx: AssistantContext
): Promise<{ replies: string[]; orders?: OrderHistoryRow[] }> {
  if (!ctx.userId || !ctx.role) {
    return { replies: ['Please log in to view account orders from the dashboard.'] };
  }

  if (ctx.role === 'reseller') {
    const orders = await Order.find({
      resellerId: ctx.userId,
      source: 'reseller_store',
      status: { $nin: ['delivered', 'refunded', 'cancelled'] },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderId network bundleSize recipientPhone status totalAmount createdAt');

    if (!orders.length) {
      return { replies: ['No pending store orders on your account right now.'] };
    }
    const rows = orders.map((o) => ({
      orderId: o.orderId,
      network: o.network,
      bundleSize: o.bundleSize,
      recipientPhone: o.recipientPhone,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
    }));
    return {
      replies: [
        'Recent non-delivered store orders:',
        ...rows.map(formatOrderLine),
        'Open Complaints in your dashboard to report missing data (2–24 hours after order).',
      ],
      orders: rows,
    };
  }

  if (ctx.role === 'agent') {
    const orders = await Order.find({
      agentId: ctx.userId,
      status: { $nin: ['delivered', 'refunded', 'cancelled'] },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderId network bundleSize recipientPhone status totalAmount createdAt');

    const wallet = await Wallet.findOne({ userId: ctx.userId });
    const balance = wallet?.balance ?? 0;
    const lines = [
      `Wallet balance: GHS ${balance.toFixed(2)}`,
      orders.length
        ? ['Recent pending orders:', ...orders.map((o) => formatOrderLine(o as OrderHistoryRow))]
        : ['No pending agent orders right now.'],
    ].flat();
    return { replies: lines };
  }

  if (ctx.role === 'admin') {
    const [resellerPending, customerPending] = await Promise.all([
      Complaint.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      CustomerComplaint.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    ]);
    return {
      replies: [
        `Open reseller complaints: ${resellerPending}`,
        `Open customer complaints: ${customerPending}`,
        'Use Admin Search to find orders by phone, email, or order ID.',
        'Shortcuts: /admin/search · /admin/complaints · /admin/orders',
      ],
    };
  }

  return { replies: ['No account data available for this role.'] };
}

async function handleQuickAction(
  actionId: string,
  ctx: AssistantContext,
  session: AssistantSessionState
): Promise<AssistantChatResult> {
  const next: AssistantSessionState = { ...session };

  switch (actionId) {
    case 'track_order':
      return startOrderLookup(ctx, session, [
        'Enter the email or phone number you used when buying.',
        'We will send a verification code if we find matching orders.',
      ]);

    case 'check_orders':
    case 'not_received':
      return startOrderLookup(
        ctx,
        session,
        actionId === 'not_received'
          ? [
              'I can help report missing data. First verify your orders — complaints are allowed 2–24 hours after purchase.',
              'Enter the email or phone number you used when buying.',
            ]
          : ['Enter the email or phone number you used when buying.']
      );

    case 'use_email':
      next.step = 'await_email';
      next.identifierType = 'email';
      return {
        replies: ['Enter the email address you used at checkout.'],
        actions: [],
        session: next,
      };

    case 'use_phone':
      next.step = 'await_phone';
      next.identifierType = 'phone';
      return {
        replies: ['Enter the recipient phone number (e.g. 0241234567). A code will be sent to the email on your latest order.'],
        actions: [],
        session: next,
      };

    case 'how_buy':
      return {
        replies: [
          'Pick a network on the store, choose a bundle, enter recipient phone and your email, then pay with Paystack. Data is delivered automatically after payment.',
        ],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'become_reseller':
      return {
        replies: [
          'Tap “Become A Reseller” on the homepage, complete registration and email verification, then set up your store name and prices from your reseller dashboard.',
        ],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'become_agent':
      return {
        replies: [
          matchKnowledge('become agent') ||
            'Agent accounts are created by the platform admin — there is no public agent sign-up. If you already have credentials, use Agent Login on the homepage. To sell through your own store, choose Become A Reseller.',
        ],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'contact_support':
      return {
        replies: [
          matchKnowledge('support') ||
            'For urgent help, contact platform support via WhatsApp or email shown on the homepage. I can also help with order tracking, delivery times, and missing data reports.',
        ],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'menu':
      return {
        replies: [GREETING],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'faq_delivery':
      return {
        replies: [matchKnowledge('delivery') || GREETING],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'agent_orders':
    case 'reseller_orders': {
      const data = await loadAuthenticatedOrders(ctx);
      return { ...data, actions: actionsForContext(ctx), session: { step: 'idle' } };
    }

    case 'agent_wallet': {
      if (ctx.role !== 'agent' || !ctx.userId) {
        return { replies: ['Log in as an agent to view wallet balance.'], actions: actionsForContext(ctx), session: { step: 'idle' } };
      }
      const wallet = await Wallet.findOne({ userId: ctx.userId });
      return {
        replies: [`Your wallet balance is GHS ${(wallet?.balance ?? 0).toFixed(2)}.`],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };
    }

    case 'agent_api':
      return {
        replies: [
          'Agent API keys are in Developer API after login. Keep your secret safe, use IP whitelist, and send packageId + recipientPhone to purchase endpoints.',
        ],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'reseller_complaints':
      return {
        replies: ['Open Reseller → Complaints in your dashboard to report store orders not received after 2 hours.'],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'admin_search':
      return {
        replies: ['Use Admin → Search to find resellers, phone numbers, and order IDs across the platform.'],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    case 'admin_complaints':
      return {
        replies: ['Open Admin → Complaints to review reseller and customer complaints.'],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };

    default:
      return {
        replies: [GREETING],
        actions: actionsForContext(ctx),
        session: { step: 'idle' },
      };
  }
}

async function applyDetectedIntent(
  intent: DetectedIntent,
  ctx: AssistantContext,
  session: AssistantSessionState
): Promise<AssistantChatResult | null> {
  if (!intent) return null;

  if (intent.kind === 'topic') {
    return {
      replies: [intent.answer],
      actions: actionsForContext(ctx),
      session: { step: 'idle' },
    };
  }

  if (intent.action === 'menu') {
    return {
      replies: [GREETING],
      actions: actionsForContext(ctx),
      session: { step: 'idle' },
    };
  }

  return handleQuickAction(intent.action, ctx, { step: 'idle' });
}

/** Escape mid-flow when user asks a new question (not entering OTP/email/phone). */
async function tryInterruptWithIntent(
  text: string,
  ctx: AssistantContext,
  session: AssistantSessionState
): Promise<AssistantChatResult | null> {
  const intent = detectIntent(text, ctx);
  if (!intent) return null;

  if (intent.kind === 'action' && (intent.action === 'use_email' || intent.action === 'use_phone')) {
    return handleQuickAction(intent.action, ctx, session);
  }

  return applyDetectedIntent(intent, ctx, session);
}

export async function processSupportChat(input: {
  message: string;
  action?: string;
  context: AssistantContext;
  session: AssistantSessionState;
  supportSessionToken?: string;
}): Promise<AssistantChatResult> {
  const ctx = input.context;
  const session: AssistantSessionState = { ...input.session };
  const text = input.message.trim();

  if (input.action) {
    return handleQuickAction(input.action, ctx, session);
  }

  if (!text && session.step === 'idle') {
    return {
      replies: [GREETING],
      actions: actionsForContext(ctx),
      session: { step: 'idle' },
    };
  }

  if (session.step === 'idle') {
    const intent = detectIntent(text, ctx);
    const fromIntent = await applyDetectedIntent(intent, ctx, session);
    if (fromIntent) return fromIntent;

    const faq = (await searchFaqs(text)) || matchKnowledge(text);
    if (faq) {
      return { replies: [faq], actions: actionsForContext(ctx), session: { step: 'idle' } };
    }

    if (isEmail(text)) {
      return processSupportChat({
        ...input,
        session: { step: 'await_email', storeSlug: PLATFORM_ORDER_SCOPE },
      });
    }
    try {
      assertGhanaPhone(text);
      return processSupportChat({
        ...input,
        session: { step: 'await_phone', storeSlug: PLATFORM_ORDER_SCOPE },
      });
    } catch {
      /* not a phone */
    }

    if (ctx.page === 'dashboard' && ctx.userId) {
      const data = await loadAuthenticatedOrders(ctx);
      return { ...data, actions: actionsForContext(ctx), session: { step: 'idle' } };
    }
    return menuResult(ctx);
  }

  if (session.step === 'await_identifier_type') {
    const interrupted = await tryInterruptWithIntent(text, ctx, session);
    if (interrupted) return interrupted;

    if (isEmail(text)) {
      session.identifierType = 'email';
      return processSupportChat({ ...input, message: text, session: { ...session, step: 'await_email' } });
    }
    try {
      assertGhanaPhone(text);
      session.identifierType = 'phone';
      return processSupportChat({ ...input, message: text, session: { ...session, step: 'await_phone' } });
    } catch {
      /* not a phone — fall through */
    }

    return menuResult(ctx);
  }

  if (session.step === 'await_email') {
    const interrupted = await tryInterruptWithIntent(text, ctx, session);
    if (interrupted) return interrupted;

    if (!isEmail(text)) {
      const intent = detectIntent(text, ctx);
      if (intent) {
        const interrupted = await applyDetectedIntent(intent, ctx, session);
        if (interrupted) return interrupted;
      }
      return menuResult(ctx);
    }
    const slug = orderLookupScope(ctx, session);
    try {
      const result = await requestOrderHistoryOtp(slug, text);
      session.pendingIdentifier = text.trim().toLowerCase();
      session.identifierType = 'email';
      session.step = 'await_otp';
      return {
        replies: [`Code sent to ${result.maskedEmail}. Enter the 6-digit verification code.`],
        actions: [],
        session,
      };
    } catch (err) {
      return {
        replies: [err instanceof AppError ? err.message : 'Could not send verification code'],
        actions: [
          { id: 'use_email', label: 'Try another email' },
          { id: 'use_phone', label: 'Use phone instead' },
        ],
        session: { ...session, step: 'await_identifier_type' },
      };
    }
  }

  if (session.step === 'await_phone') {
    const interrupted = await tryInterruptWithIntent(text, ctx, session);
    if (interrupted) return interrupted;

    try {
      assertGhanaPhone(text);
    } catch {
      const intent = detectIntent(text, ctx);
      if (intent) {
        const interrupted = await applyDetectedIntent(intent, ctx, session);
        if (interrupted) return interrupted;
      }
      return menuResult(ctx);
    }
    const slug = orderLookupScope(ctx, session);
    try {
      const result = await requestOrderHistoryOtpByPhone(slug, text);
      session.pendingIdentifier = assertGhanaPhone(text);
      session.identifierType = 'phone';

      if (result.verifiedImmediately && result.orders && result.sessionToken) {
        session.step = 'show_orders';
        session.storeSlug = slug;
        const orderLines = result.orders.map(formatOrderLine);
        return {
          replies: [
            `Found ${result.orders.length} order(s) for this number:`,
            ...orderLines,
            'Reply with an order ID to see details or report missing data.',
          ],
          actions: result.orders.slice(0, 5).map((o) => ({
            id: `pick_order:${o.orderId}`,
            label: `Report ${o.orderId.slice(-8)}`,
          })),
          orders: result.orders,
          session,
          sessionToken: result.sessionToken,
        };
      }

      session.step = 'await_otp';
      return {
        replies: [`Code sent to ${result.maskedEmail}. Enter the 6-digit verification code.`],
        actions: [],
        session,
      };
    } catch (err) {
      return {
        replies: [err instanceof AppError ? err.message : 'Could not send verification code'],
        actions: [
          { id: 'use_phone', label: 'Try another phone' },
          { id: 'use_email', label: 'Use email instead' },
        ],
        session: { ...session, step: 'await_identifier_type' },
      };
    }
  }

  if (session.step === 'await_otp') {
    if (!isOtpCode(text)) {
      const interrupted = await tryInterruptWithIntent(text, ctx, session);
      if (interrupted) return interrupted;
      return {
        replies: ['Enter the 6-digit code from your email, or tap Menu to cancel.'],
        actions: [{ id: 'menu', label: 'Menu' }],
        session,
      };
    }
    const slug = orderLookupScope(ctx, session);
    if (!session.pendingIdentifier || !session.identifierType) {
      return menuResult(ctx);
    }
    try {
      const verified =
        session.identifierType === 'email'
          ? await verifyOrderHistoryOtp(slug, session.pendingIdentifier, text)
          : await verifyOrderHistoryOtpByPhone(slug, session.pendingIdentifier, text);

      session.step = 'show_orders';
      session.storeSlug = slug;
      const orderLines = verified.orders.map(formatOrderLine);
      return {
        replies: [
          `Found ${verified.orders.length} order(s):`,
          ...orderLines,
          'Reply with an order ID to see details or report missing data.',
        ],
        actions: verified.orders.slice(0, 5).map((o) => ({
          id: `pick_order:${o.orderId}`,
          label: `Report ${o.orderId.slice(-8)}`,
        })),
        orders: verified.orders,
        session,
        sessionToken: verified.sessionToken,
      };
    } catch (err) {
      return {
        replies: [err instanceof AppError ? err.message : 'Invalid code'],
        actions: [],
        session,
      };
    }
  }

  if (session.step === 'show_orders' || session.step === 'await_order_pick') {
    const interrupted = await tryInterruptWithIntent(text, ctx, session);
    if (interrupted) return interrupted;

    const orderId = text.toUpperCase().startsWith('ORD') ? text : text;
    let orders: OrderHistoryRow[] = [];

    if (input.supportSessionToken) {
      const payload = verifySupportSession(input.supportSessionToken);
      orders = await getVerifiedStoreOrders(
        payload.storeSlug,
        payload.identifier,
        payload.identifierType
      );
    }

    const picked = orders.find((o) => o.orderId === orderId || o.orderId.includes(orderId));
    if (!picked) {
      return menuResult(ctx);
    }

    session.selectedOrderId = picked.orderId;
    session.step = 'confirm_complaint';

    const orderDoc = await Order.findOne({ orderId: picked.orderId });
    if (!orderDoc?.resellerId) {
      return menuResult(ctx);
    }

    const orderSlug = await getOrderStoreSlug(picked.orderId);
    if (orderSlug) session.storeSlug = orderSlug;

    const eligibility = await canSubmitCustomerComplaint(orderDoc.resellerId.toString(), {
      orderId: picked.orderId,
      network: picked.network,
      status: picked.status,
      createdAt: picked.createdAt,
    });

    return {
      replies: [
        `Order ${picked.orderId}: ${picked.network} ${picked.bundleSize} → ${picked.recipientPhone} · Status: ${picked.status}`,
        eligibility.allowed
          ? 'This order is eligible for a “Data not received” report. Confirm below to submit.'
          : eligibility.reason || 'Cannot report this order.',
      ],
      actions: eligibility.allowed
        ? [
            { id: `submit_complaint:${picked.orderId}`, label: 'Submit complaint' },
            { id: 'check_orders', label: 'Back to orders' },
          ]
        : actionsForContext(ctx),
      session,
      sessionToken: input.supportSessionToken,
    };
  }

  if (session.step === 'confirm_complaint' && session.selectedOrderId) {
    const lower = text.toLowerCase();
    const interrupted = await tryInterruptWithIntent(text, ctx, session);
    if (interrupted) return interrupted;

    if (!/^(yes|confirm|submit|report)/.test(lower)) {
      return {
        replies: ['Tap “Submit complaint” or type “confirm” to report this order.'],
        actions: [
          { id: `submit_complaint:${session.selectedOrderId}`, label: 'Submit complaint' },
        ],
        session,
        sessionToken: input.supportSessionToken,
      };
    }
  }

  return menuResult(ctx);
}

export async function submitSupportComplaint(input: {
  orderId: string;
  storeSlug?: string;
  supportSessionToken: string;
  description?: string;
}) {
  verifySupportSession(input.supportSessionToken);
  const storeSlug = input.storeSlug || (await getOrderStoreSlug(input.orderId));
  if (!storeSlug) throw new AppError('Could not resolve store for this order');
  const complaint = await createCustomerComplaint({
    orderId: input.orderId,
    storeSlug,
    description: input.description,
  });
  return complaint;
}
