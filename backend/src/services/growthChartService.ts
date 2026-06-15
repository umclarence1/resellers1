import { Order } from '../models/Order';

export interface GrowthChartPoint {
  date: string;
  label: string;
  orders: number;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric' });
}

export async function getOrderGrowthChart(
  match: Record<string, unknown>,
  days = 14,
  amountField: 'sellingPrice' | 'totalAmount' | 'profit' = 'sellingPrice'
): Promise<GrowthChartPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);

  const amountExpr =
    amountField === 'profit'
      ? '$profit'
      : amountField === 'totalAmount'
        ? '$totalAmount'
        : '$sellingPrice';

  const rows = await Order.aggregate([
    { $match: { ...match, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        amount: { $sum: amountExpr },
      },
    },
  ]);

  const byDate = new Map(rows.map((r) => [r._id as string, r]));

  const series: GrowthChartPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    series.push({
      date: key,
      label: formatDayLabel(d),
      orders: row?.orders || 0,
      amount: Math.round((row?.amount || 0) * 100) / 100,
    });
  }

  return series;
}
