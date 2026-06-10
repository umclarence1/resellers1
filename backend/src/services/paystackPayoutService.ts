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
    reason: `DataBundle reseller withdrawal`,
    reference,
  });

  return {
    recipientCode: recipient.recipient_code,
    transferCode: transfer.transfer_code,
    transferReference: transfer.reference || reference,
    transferStatus: transfer.status,
  };
}
