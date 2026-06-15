import { api } from './api';

export type AssistantPage = 'home' | 'store' | 'dashboard';

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

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type AssistantAction = { id: string; label: string };

export type OrderHistoryRow = {
  orderId: string;
  network: string;
  bundleSize: string;
  recipientPhone: string;
  status: string;
  totalAmount: number;
  createdAt: string;
};

export type ChatResponse = {
  replies: string[];
  actions: AssistantAction[];
  orders?: OrderHistoryRow[];
  session: AssistantSessionState;
  sessionToken?: string;
};

export type AssistantContext = {
  page: AssistantPage;
  storeSlug?: string;
  role?: 'admin' | 'agent' | 'reseller' | null;
  userId?: string;
};

export async function sendSupportMessage(input: {
  message: string;
  action?: string;
  context: AssistantContext;
  session: AssistantSessionState;
  supportSessionToken?: string;
}): Promise<ChatResponse> {
  const { data } = await api.post('/support/chat', input);
  return data.data as ChatResponse;
}

export function resolveAssistantContext(
  pathname: string,
  storeSlug: string | null,
  role?: string | null,
  userId?: string
): AssistantContext {
  if (pathname.startsWith('/admin') || pathname.startsWith('/agent') || pathname.startsWith('/reseller')) {
    return {
      page: 'dashboard',
      role: (role as AssistantContext['role']) || null,
      userId,
    };
  }
  if (storeSlug || pathname.startsWith('/store/') || pathname.startsWith('/buy/')) {
    const slugFromPath = pathname.match(/^\/store\/([^/]+)/)?.[1];
    return {
      page: 'store',
      storeSlug: storeSlug || slugFromPath || undefined,
    };
  }
  return { page: 'home' };
}
