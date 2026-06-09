import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { verifyPayment, verifyWebhookSignature } from '../utils/paystack';
import { processPaystackSuccess } from '../services/paymentFulfillmentService';

const router = Router();

router.post(
  '/paystack',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (signature && !verifyWebhookSignature(payload, signature)) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, metadata, amount } = event.data;
      const paidAmount = amount / 100;
      await processPaystackSuccess(reference, metadata || {}, event.data.customer?.email, paidAmount);
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
      fulfillment = await processPaystackSuccess(
        reference,
        metadata,
        payment.customer?.email,
        payment.amount / 100
      );
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
