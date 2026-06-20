/** Reseller profit per sale = selling price − reseller base price */
export function computeResellerProfit(sellingPrice: number, basePrice: number): number {
  const profit = sellingPrice - basePrice;
  return Math.round(Math.max(0, profit) * 100) / 100;
}

/** Admin markup inherited by every sub-reseller tier (max sell − API cost). */
export function computeInheritedMaxMarkup(costPrice: number, maxSellingPrice: number): number {
  return Math.round(Math.max(0, maxSellingPrice - costPrice) * 100) / 100;
}

/** Sub-reseller max = assigned base + inherited markup. */
export function computeSubResellerMaxFromFloor(
  floor: number,
  costPrice: number,
  maxSellingPrice: number
): number {
  return Math.round((floor + computeInheritedMaxMarkup(costPrice, maxSellingPrice)) * 100) / 100;
}

export function formatProfitRange(min: number, max: number): string {
  if (max <= 0) return 'GHS 0.00';
  if (min === max) return `GHS ${max.toFixed(2)}`;
  return `GHS ${min.toFixed(2)} – ${max.toFixed(2)}`;
}
