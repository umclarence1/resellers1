import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { verifyPayment, verifyWebhookSignature } from '../utils/paystack';
import { processPaystackSuccess } from '../services/paymentFulfillmentService';
import { handlePaystackTransferEvent } from '../services/paystackTransferService';
import { env } from '../config/env';

const router = Router();

router.post(
  '/paystack',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (env.nodeEnv === 'production' && !signature) {
      throw new AppError('Missing Paystack signature', 400);
    }
    if (signature && !verifyWebhookSignature(payload, signature)) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, metadata, amount } = event.data;
      const paidAmount = amount / 100;
      try {
        await processPaystackSuccess(reference, metadata || {}, event.data.customer?.email, paidAmount);
      } catch (err) {
        console.error('Paystack fulfillment error:', err);
      }
    }

    if (event.event?.startsWith('transfer.')) {
      try {
        await handlePaystackTransferEvent(event.event, event.data || {});
      } catch (err) {
        console.error('Paystack transfer webhook error:', err);
      }
    }

    res.json({ success: true });
  })
);

router.get(
  '/verify/:reference',
  asyncHandler(async (req, res) => {
    const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
    const payment = await verifyPayment(reference);
    const metadata = (payment.metadata || {}) as Record<string, unknown>;

    let fulfillment = null;
    if (payment.status === 'success') {
      try {
        fulfillment = await processPaystackSuccess(
          reference,
          metadata,
          payment.customer?.email,
          payment.amount / 100
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fulfillment failed';
        res.status(400).json({ success: false, message, data: payment });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        ...payment,
        fulfillment,
      },
    });
  })
);

export default router;
