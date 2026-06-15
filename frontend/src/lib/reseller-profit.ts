/** Reseller profit per sale = selling price − reseller base price */
export function computeResellerProfit(sellingPrice: number, basePrice: number): number {
  const profit = sellingPrice - basePrice;
  return Math.round(Math.max(0, profit) * 100) / 100;
}

export function formatProfitRange(min: number, max: number): string {
  if (max <= 0) return 'GHS 0.00';
  if (min === max) return `GHS ${max.toFixed(2)}`;
  return `GHS ${min.toFixed(2)} – ${max.toFixed(2)}`;
}
