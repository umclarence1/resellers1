import { IWithdrawal } from '../models/Withdrawal';
import { AppError } from '../middleware/errorHandler';
import {
  createTransferRecipient,
  initiateTransfer,
  MOBILE_MONEY_BANK_CODES,
  ghsToPesewas,
} from '../utils/paystack';
import { env } from '../config/env';

export async function sendWithdrawalViaPaystack(withdrawal: IWithdrawal) {
  if (!env.paystack.secretKey) {
    throw new AppError('Paystack is not configured for payouts');
  }

  const bankCode = MOBILE_MONEY_BANK_CODES[withdrawal.network];
  if (!bankCode) {
    throw new AppError(`Unsupported payout network: ${withdrawal.network}`);
  }

  const recipient = await createTransferRecipient({
    name: withdrawal.accountName,
    accountNumber: withdrawal.mobileNumber,
    bankCode,
  });

  const reference = `WDR-${withdrawal._id}-${Date.now()}`;
  const transfer = await initiateTransfer({
    amountInPesewas: ghsToPesewas(withdrawal.amount),
    recipientCode: recipient.recipient_code,
    reason: `topdealsgh reseller withdrawal`,
    reference,
  });

  return {
    recipientCode: recipient.recipient_code,
    transferCode: transfer.transfer_code,
    transferReference: transfer.reference || reference,
    transferStatus: transfer.status,
  };
}

/** Send exact withdrawal amount (GHS) to reseller MoMo; Paystack fees come from your balance. */
export async function applyPaystackTransferToWithdrawal(withdrawal: IWithdrawal): Promise<{
  withdrawal: IWithdrawal;
  paystackError?: string;
}> {
  try {
    const payout = await sendWithdrawalViaPaystack(withdrawal);
    withdrawal.paystackTransferCode = payout.transferCode;
    withdrawal.paystackTransferReference = payout.transferReference;
    withdrawal.paystackTransferStatus = payout.transferStatus;
    withdrawal.adminNote = [
      withdrawal.adminNote,
      `Paystack transfer GHS ${withdrawal.amount} (${payout.transferReference})`,
    ]
      .filter(Boolean)
      .join(' | ');
    await withdrawal.save();
    return { withdrawal };
  } catch (payoutErr) {
    const msg = payoutErr instanceof Error ? payoutErr.message : 'Paystack payout failed';
    withdrawal.adminNote = [
      withdrawal.adminNote,
      `Paystack payout failed: ${msg}. Top up Paystack balance (amount + fees) and retry.`,
    ]
      .filter(Boolean)
      .join(' | ');
    await withdrawal.save();
    return { withdrawal, paystackError: msg };
  }
}
