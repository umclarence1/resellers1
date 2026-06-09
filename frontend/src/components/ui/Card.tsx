import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm text-gray-900', className)}>
      {children}
    </div>
  );
}

export function DarkCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-navy-card rounded-xl border border-navy-border', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4 border-b border-gray-100', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

type StatColor = 'gold' | 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan' | 'pink';

const statStyles: Record<StatColor, { card: string; icon: string; glow: string; value: string }> = {
  gold: {
    card: 'border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-amber-400 to-amber-600 text-navy shadow-lg shadow-amber-500/30',
    glow: 'bg-amber-400/20',
    value: 'text-amber-200',
  },
  blue: {
    card: 'border-blue-500/25 bg-gradient-to-br from-blue-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/30',
    glow: 'bg-blue-400/20',
    value: 'text-blue-200',
  },
  green: {
    card: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30',
    glow: 'bg-emerald-400/20',
    value: 'text-emerald-200',
  },
  orange: {
    card: 'border-orange-500/25 bg-gradient-to-br from-orange-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30',
    glow: 'bg-orange-400/20',
    value: 'text-orange-200',
  },
  purple: {
    card: 'border-purple-500/25 bg-gradient-to-br from-purple-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg shadow-purple-500/30',
    glow: 'bg-purple-400/20',
    value: 'text-purple-200',
  },
  red: {
    card: 'border-red-500/25 bg-gradient-to-br from-red-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg shadow-red-500/30',
    glow: 'bg-red-400/20',
    value: 'text-red-200',
  },
  cyan: {
    card: 'border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-navy shadow-lg shadow-cyan-500/30',
    glow: 'bg-cyan-400/20',
    value: 'text-cyan-200',
  },
  pink: {
    card: 'border-pink-500/25 bg-gradient-to-br from-pink-500/15 via-navy-card to-navy-card',
    icon: 'bg-gradient-to-br from-pink-400 to-pink-600 text-white shadow-lg shadow-pink-500/30',
    glow: 'bg-pink-400/20',
    value: 'text-pink-200',
  },
};

export function StatCard({
  title,
  value,
  icon,
  color = 'gold',
}: {
  title: string;
  value: string | number;
  icon?: ReactNode;
  color?: StatColor;
}) {
  const style = statStyles[color];

  return (
    <div className={cn('relative overflow-hidden rounded-xl border p-5 transition-transform hover:scale-[1.02]', style.card)}>
      <div className={cn('absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl', style.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{title}</p>
          <p className={cn('text-xl sm:text-2xl font-bold mt-2 truncate', style.value)}>{value}</p>
        </div>
        {icon && (
          <div className={cn('p-3 rounded-xl shrink-0', style.icon)}>{icon}</div>
        )}
      </div>
    </div>
  );
}
