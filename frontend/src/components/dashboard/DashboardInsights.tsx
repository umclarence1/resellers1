import GrowthAreaChart, { GrowthPoint } from '@/components/dashboard/GrowthAreaChart';
import RecentAlertsPanel from '@/components/dashboard/RecentAlertsPanel';
import { buildOrderAlerts } from '@/lib/dashboard-alerts';

export default function DashboardInsights({
  growthChart,
  stats,
  chartTitle,
  chartSubtitle,
  amountLabel,
  ordersLink,
  accent = 'blue',
}: {
  growthChart?: GrowthPoint[];
  stats: Record<string, number>;
  chartTitle: string;
  chartSubtitle?: string;
  amountLabel?: string;
  ordersLink?: string;
  accent?: 'blue' | 'emerald' | 'amber';
}) {
  const chartData: GrowthPoint[] = (growthChart || []).map((d) => ({
    label: d.label,
    orders: d.orders,
    amount: d.amount,
  }));

  const alerts = buildOrderAlerts(stats, ordersLink);

  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-8">
      <div className="lg:col-span-2">
        <GrowthAreaChart
          title={chartTitle}
          subtitle={chartSubtitle}
          data={chartData}
          amountLabel={amountLabel}
          accent={accent}
        />
      </div>
      <RecentAlertsPanel alerts={alerts} ordersLink={ordersLink} />
    </div>
  );
}
