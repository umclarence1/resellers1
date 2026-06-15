import { OrderSource } from '../models/Order';
import { roundMoney } from '../utils/helpers';
import { computeResellerProfit } from './resellerProfitService';

export function getAdminBasePrice(
  source: OrderSource,
  prices: { resellerBasePrice: number; agentPrice: number }
): number {
  return source === 'reseller_store' ? prices.resellerBasePrice : prices.agentPrice;
}

export function computeResellerOrderProfit(sellingPrice: number, resellerBasePrice: number): number {
  return computeResellerProfit(sellingPrice, resellerBasePrice);
}

export function computeAdminOrderProfit(adminBasePrice: number, apiCost: number): number {
  return roundMoney(adminBasePrice - apiCost);
}
