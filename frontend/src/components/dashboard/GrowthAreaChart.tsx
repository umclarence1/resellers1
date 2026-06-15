import { DarkCard } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

export type GrowthPoint = {
  label: string;
  orders: number;
  amount: number;
};

type Accent = 'blue' | 'emerald' | 'amber';

const accentStyles: Record<Accent, { stroke: string; fill: string; dot: string }> = {
  blue: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.22)', dot: '#7dd3fc' },
  emerald: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.2)', dot: '#6ee7b7' },
  amber: { stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.18)', dot: '#fcd34d' },
};

function buildPath(values: number[], width: number, height: number, padY: number): string {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - padY - (v / max) * (height - padY * 2);
    return { x, y };
  });

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

export default function GrowthAreaChart({
  title,
  subtitle,
  data,
  amountLabel = 'Amount',
  accent = 'blue',
}: {
  title: string;
  subtitle?: string;
  data: GrowthPoint[];
  amountLabel?: string;
  accent?: Accent;
}) {
  const colors = accentStyles[accent];
  const width = 520;
  const height = 160;
  const padY = 12;
  const orderValues = data.map((d) => d.orders);
  const linePath = buildPath(orderValues, width, height, padY);
  const areaPath = linePath
    ? `${linePath} L ${width} ${height} L 0 ${height} Z`
    : '';
  const totalOrders = orderValues.reduce((s, v) => s + v, 0);
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);

  return (
    <DarkCard className="p-5 h-full border-navy-border/80">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0">
          <p>{totalOrders} orders</p>
          <p className="text-gray-300 font-medium">{formatCurrency(totalAmount)} {amountLabel.toLowerCase()}</p>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No activity in the last 14 days yet.</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`growth-fill-${accent}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.fill} />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill={`url(#growth-fill-${accent})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={colors.stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="flex justify-between mt-2 text-[10px] text-gray-500 px-0.5">
            {data.filter((_, i) => i % 2 === 0 || i === data.length - 1).map((d) => (
              <span key={d.label}>{d.label}</span>
            ))}
          </div>
        </div>
      )}
    </DarkCard>
  );
}
