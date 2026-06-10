import { Withdrawal } from '../models/Withdrawal';
import { markWithdrawalPaid } from './withdrawalService';
import { createNotification } from './notificationService';

export async function handlePaystackTransferEvent(
  event: string,
  data: { reference?: string; transfer_code?: string; status?: string; reason?: string }
) {
  const reference = data.reference || data.transfer_code;
  if (!reference) return;

  const withdrawal = await Withdrawal.findOne({
    $or: [
      { paystackTransferReference: reference },
      { paystackTransferCode: data.transfer_code },
    ],
  });
  if (!withdrawal) return;

  if (event === 'transfer.success') {
    withdrawal.paystackTransferStatus = 'success';
    await withdrawal.save();
    if (withdrawal.status === 'approved') {
      await markWithdrawalPaid(withdrawal._id.toString());
      await createNotification(
        withdrawal.userId,
        'withdrawal_paid',
        'Withdrawal Paid',
        `Your withdrawal of GHS ${withdrawal.amount} has been sent to your MoMo via Paystack.`
      );
    }
    return;
  }

  if (event === 'transfer.failed' || event === 'transfer.reversed') {
    withdrawal.paystackTransferStatus = data.status || event;
    withdrawal.adminNote = [
      withdrawal.adminNote,
      `Paystack ${event}: ${data.reason || 'see Paystack dashboard'}`,
    ].filter(Boolean).join(' | ');
    await withdrawal.save();
  }
}
