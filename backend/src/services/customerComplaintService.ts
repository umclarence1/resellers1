import { CustomerComplaint } from '../models/CustomerComplaint';
import { Complaint } from '../models/Complaint';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { getSettings } from './settingsService';
import type { ComplaintOrderContext } from './settingsService';
import { Network } from '../models/Package';

const COMPLAINT_MIN_HOURS = 2;
const COMPLAINT_MAX_HOURS = 24;

export async function canSubmitCustomerComplaint(
  resellerId: string,
  order: ComplaintOrderContext
): Promise<{ allowed: boolean; reason?: string; hoursSinceOrder?: number }> {
  const settings = await getSettings();
  const reseller = await User.findById(resellerId);
  const hoursSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);

  if (!settings.complaintSettings.globalEnabled) {
    return { allowed: false, reason: 'Complaints are currently disabled', hoursSinceOrder };
  }

  if (reseller?.complaintEnabled === false) {
    return { allowed: false, reason: 'Complaints are disabled for this store', hoursSinceOrder };
  }

  const userOverride = settings.complaintSettings.userOverrides.get(resellerId);
  if (userOverride === false) {
    return { allowed: false, reason: 'Complaints are disabled for this store', hoursSinceOrder };
  }

  if (['refunded', 'cancelled'].includes(order.status)) {
    return { allowed: false, reason: 'This order is closed', hoursSinceOrder };
  }

  if (hoursSinceOrder < COMPLAINT_MIN_HOURS) {
    const waitMins = Math.ceil((COMPLAINT_MIN_HOURS - hoursSinceOrder) * 60);
    return {
      allowed: false,
      reason: `Wait ${waitMins} more minute${waitMins === 1 ? '' : 's'} — complaints open 2 hours after order`,
      hoursSinceOrder,
    };
  }

  if (hoursSinceOrder > COMPLAINT_MAX_HOURS) {
    return { allowed: false, reason: 'Complaint window expired (24 hours)', hoursSinceOrder };
  }

  const networkEnabled =
    settings.complaintSettings.networkSettings[order.network as Network] !== false;
  if (!networkEnabled) {
    return { allowed: false, reason: `Complaints disabled for ${order.network}`, hoursSinceOrder };
  }

  const existingReseller = await Complaint.findOne({ orderId: order.orderId });
  if (existingReseller) {
    return { allowed: false, reason: 'Complaint already submitted for this order', hoursSinceOrder };
  }

  const existingCustomer = await CustomerComplaint.findOne({ orderId: order.orderId });
  if (existingCustomer) {
    return { allowed: false, reason: 'Complaint already submitted for this order', hoursSinceOrder };
  }

  return { allowed: true, hoursSinceOrder };
}

export async function createCustomerComplaint(input: {
  orderId: string;
  storeSlug: string;
  issueType?: string;
  description?: string;
}) {
  const order = await Order.findOne({
    orderId: input.orderId,
    source: 'reseller_store',
  });
  if (!order) throw new AppError('Order not found', 404);
  if (!order.resellerId) throw new AppError('Order not found', 404);

  const reseller = await User.findById(order.resellerId);
  const slug = reseller?.resellerStore?.slug;
  if (!slug || slug !== input.storeSlug.toLowerCase()) {
    throw new AppError('Order does not belong to this store', 403);
  }

  const check = await canSubmitCustomerComplaint(order.resellerId.toString(), {
    orderId: order.orderId,
    network: order.network,
    status: order.status,
    createdAt: order.createdAt,
  });
  if (!check.allowed) {
    throw new AppError(check.reason || 'Cannot submit complaint');
  }

  const complaint = await CustomerComplaint.create({
    orderId: order.orderId,
    resellerId: order.resellerId,
    storeSlug: slug,
    customerEmail: order.customerEmail,
    recipientPhone: order.recipientPhone,
    issueType: (input.issueType || 'Data Not Received') as
      | 'Data Not Received'
      | 'Wrong Bundle'
      | 'Wrong Number'
      | 'Delayed Delivery'
      | 'Other',
    description: input.description || 'Data not received after purchase',
  });

  return complaint;
}
