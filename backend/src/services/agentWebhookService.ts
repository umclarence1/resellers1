import axios from 'axios';
import { User } from '../models/User';
import { IOrder } from '../models/Order';

export async function notifyagentWebhook(order: IOrder): Promise<void> {
  if (order.source !== 'agent_api' || !order.agentId) return;
  if (!['delivered', 'failed'].includes(order.status)) return;

  try {
    const dealer = await User.findById(order.agentId);
    const webhookUrl = dealer?.agentApi?.webhookUrl;
    if (!webhookUrl) return;

    await axios.post(
      webhookUrl,
      {
        orderId: order.orderId,
        status: order.status,
        recipientPhone: order.recipientPhone,
        network: order.network,
        bundleSize: order.bundleSize,
        sellingPrice: order.sellingPrice,
        updatedAt: order.updatedAt,
      },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Dealer webhook delivery failed:', err instanceof Error ? err.message : err);
  }
}
