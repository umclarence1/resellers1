import { Router } from 'express';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { supportChatLimiter, otpLimiter } from '../middleware/rateLimiter';
import {
  processSupportChat,
  submitSupportComplaint,
  type AssistantContext,
  type AssistantSessionState,
} from '../services/supportAssistantService';
import {
  requestOrderHistoryOtpByPhone,
  verifyOrderHistoryOtpByPhone,
} from '../services/orderHistoryService';

const router = Router();

function buildContext(req: AuthRequest, body: { context?: Partial<AssistantContext> }): AssistantContext {
  const user = req.user;
  const ctx = body.context || {};
  return {
    page: ctx.page || 'home',
    storeSlug: ctx.storeSlug,
    role: user?.role ?? ctx.role ?? null,
    userId: user?._id?.toString() ?? ctx.userId,
  };
}

router.post(
  '/chat',
  supportChatLimiter,
  optionalAuthenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { message, action, session, supportSessionToken } = req.body as {
      message?: string;
      action?: string;
      session?: AssistantSessionState;
      supportSessionToken?: string;
      context?: Partial<AssistantContext>;
    };

    let resolvedAction = action;
    if (resolvedAction?.startsWith('pick_order:')) {
      const orderId = resolvedAction.replace('pick_order:', '');
      const result = await processSupportChat({
        message: orderId,
        context: buildContext(req, req.body),
        session: { ...(session || { step: 'show_orders' }), step: 'show_orders' },
        supportSessionToken,
      });
      res.json({ success: true, data: result });
      return;
    }

    if (resolvedAction?.startsWith('submit_complaint:')) {
      const orderId = resolvedAction.replace('submit_complaint:', '');
      if (!supportSessionToken) {
        throw new AppError('Verification required before submitting a complaint');
      }
      await submitSupportComplaint({
        orderId,
        storeSlug: session?.storeSlug,
        supportSessionToken,
      });
      const result = await processSupportChat({
        message: '',
        context: buildContext(req, req.body),
        session: { step: 'idle' },
      });
      res.json({
        success: true,
        data: {
          ...result,
          replies: [
            `Complaint submitted for order ${orderId}. Our team will review it shortly.`,
            ...result.replies,
          ],
        },
      });
      return;
    }

    const result = await processSupportChat({
      message: message || '',
      action: resolvedAction,
      context: buildContext(req, req.body),
      session: session || { step: 'idle' },
      supportSessionToken,
    });

    res.json({ success: true, data: result });
  })
);

router.post(
  '/store/:slug/history/request-phone',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone?.trim()) throw new AppError('Phone number is required');
    const result = await requestOrderHistoryOtpByPhone(req.params.slug as string, phone);
    res.json({
      success: true,
      message: `Verification code sent to ${result.maskedEmail}`,
      data: result,
    });
  })
);

router.post(
  '/store/:slug/history/verify-phone',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body;
    if (!phone?.trim() || !code) throw new AppError('Phone and verification code are required');
    const result = await verifyOrderHistoryOtpByPhone(
      req.params.slug as string,
      phone,
      String(code)
    );
    res.json({ success: true, data: result });
  })
);

export default router;
