import { Withdrawal } from '../models/Withdrawal';
import { Wallet } from '../models/Wallet';
import { roundMoney } from '../utils/helpers';
import { getSettings } from './settingsService';

/** Reseller earns the markup above base price on each delivered store sale. */
export function computeResellerProfit(sellingPrice: number, basePrice: number): number {
  return roundMoney(Math.max(0, sellingPrice - basePrice));
}

export function resellerProfitRange(basePrice: number, maxSellingPrice: number) {
  return {
    minProfitPerSale: 0,
    maxProfitPerSale: computeResellerProfit(maxSellingPrice, basePrice),
  };
}

export function computePoolLiability(input: {
  totalResellerProfitOwed: number;
  pendingWithdrawalTotal: number;
  withdrawalPoolBalance: number;
}) {
  const totalOwed = roundMoney(
    input.totalResellerProfitOwed + input.pendingWithdrawalTotal
  );
  const poolShortfall = roundMoney(
    Math.max(0, totalOwed - input.withdrawalPoolBalance)
  );
  return {
    totalOwed,
    poolShortfall,
    recommendedPoolTopUp: poolShortfall,
  };
}

export async function getResellerPoolSummary() {
  const settings = await getSettings();
  const [totalResellerProfitAgg, pendingWithdrawalAgg] = await Promise.all([
    Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$profitBalance' } } }]),
    Withdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalResellerProfitOwed = totalResellerProfitAgg[0]?.total || 0;
  const pendingWithdrawalTotal = pendingWithdrawalAgg[0]?.total || 0;
  const withdrawalPoolBalance = settings.withdrawalPoolBalance || 0;

  return {
    withdrawalPoolBalance,
    totalPoolDeposits: settings.totalPoolDeposits || 0,
    totalResellerProfitOwed,
    pendingWithdrawalTotal,
    ...computePoolLiability({
      totalResellerProfitOwed,
      pendingWithdrawalTotal,
      withdrawalPoolBalance,
    }),
  };
}
