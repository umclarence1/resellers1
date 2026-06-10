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

type StatColor =
  | 'gold'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'cyan'
  | 'pink'
  | 'slate'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'rose';

const statStyles: Record<
  StatColor,
  { card: string; iconBox: string; icon: string; subtitle: string }
> = {
  slate: {
    card: 'border-slate-600/40 bg-gradient-to-br from-slate-800/80 via-navy-card/90 to-navy-card',
    iconBox: 'bg-slate-500/20 border border-slate-500/25',
    icon: 'text-slate-300',
    subtitle: 'text-slate-400',
  },
  gold: {
    card: 'border-amber-500/35 bg-gradient-to-br from-amber-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-amber-500/20 border border-amber-500/30',
    icon: 'text-amber-400',
    subtitle: 'text-amber-400/90',
  },
  amber: {
    card: 'border-amber-600/40 bg-gradient-to-br from-amber-950/60 via-[#1a1408]/90 to-navy-card',
    iconBox: 'bg-amber-500/25 border border-amber-500/35',
    icon: 'text-amber-400',
    subtitle: 'text-amber-400',
  },
  blue: {
    card: 'border-blue-500/35 bg-gradient-to-br from-blue-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-blue-500/20 border border-blue-500/30',
    icon: 'text-blue-400',
    subtitle: 'text-blue-400/90',
  },
  sky: {
    card: 'border-sky-500/35 bg-gradient-to-br from-sky-950/55 via-[#0c1520]/90 to-navy-card',
    iconBox: 'bg-sky-500/25 border border-sky-500/35',
    icon: 'text-sky-400',
    subtitle: 'text-sky-400',
  },
  green: {
    card: 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-emerald-500/20 border border-emerald-500/30',
    icon: 'text-emerald-400',
    subtitle: 'text-emerald-400/90',
  },
  emerald: {
    card: 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/65 via-[#081510]/90 to-navy-card',
    iconBox: 'bg-emerald-500/25 border border-emerald-500/35',
    icon: 'text-emerald-400',
    subtitle: 'text-emerald-400',
  },
  orange: {
    card: 'border-orange-500/35 bg-gradient-to-br from-orange-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-orange-500/20 border border-orange-500/30',
    icon: 'text-orange-400',
    subtitle: 'text-orange-400/90',
  },
  purple: {
    card: 'border-purple-500/35 bg-gradient-to-br from-purple-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-purple-500/20 border border-purple-500/30',
    icon: 'text-purple-400',
    subtitle: 'text-purple-400/90',
  },
  red: {
    card: 'border-red-500/35 bg-gradient-to-br from-red-950/55 via-navy-card/90 to-navy-card',
    iconBox: 'bg-red-500/20 border border-red-500/30',
    icon: 'text-red-400',
    subtitle: 'text-red-400/90',
  },
  rose: {
    card: 'border-rose-500/40 bg-gradient-to-br from-rose-950/60 via-[#180c10]/90 to-navy-card',
    iconBox: 'bg-rose-500/25 border border-rose-500/35',
    icon: 'text-rose-400',
    subtitle: 'text-rose-400',
  },
  cyan: {
    card: 'border-cyan-500/35 bg-gradient-to-br from-cyan-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-cyan-500/20 border border-cyan-500/30',
    icon: 'text-cyan-400',
    subtitle: 'text-cyan-400/90',
  },
  pink: {
    card: 'border-pink-500/35 bg-gradient-to-br from-pink-950/50 via-navy-card/90 to-navy-card',
    iconBox: 'bg-pink-500/20 border border-pink-500/30',
    icon: 'text-pink-400',
    subtitle: 'text-pink-400/90',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'slate',
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: StatColor;
  className?: string;
}) {
  const style = statStyles[color];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 min-h-[130px] flex flex-col justify-between',
        'transition-all duration-200 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5',
        style.card,
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold leading-snug pr-2">
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-xl shrink-0 [&_svg]:w-5 [&_svg]:h-5',
              style.iconBox,
              style.icon
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="relative mt-3">
        <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">{value}</p>
        {subtitle && (
          <p className={cn('text-sm font-medium mt-2', style.subtitle)}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
