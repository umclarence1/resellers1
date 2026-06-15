import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type Accent = 'amber' | 'purple' | 'orange' | 'rose' | 'emerald' | 'cyan';

const accents: Record<
  Accent,
  { header: string; icon: string; glow: string; empty: string }
> = {
  amber: {
    header: 'from-amber-500/25 via-amber-600/10 to-navy-card',
    icon: 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/10',
    glow: 'shadow-amber-500/5',
    empty: 'text-amber-400/60',
  },
  purple: {
    header: 'from-purple-500/25 via-purple-600/10 to-navy-card',
    icon: 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-purple-500/10',
    glow: 'shadow-purple-500/5',
    empty: 'text-purple-400/60',
  },
  orange: {
    header: 'from-orange-500/25 via-orange-600/10 to-navy-card',
    icon: 'bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-orange-500/10',
    glow: 'shadow-orange-500/5',
    empty: 'text-orange-400/60',
  },
  rose: {
    header: 'from-rose-500/25 via-rose-600/10 to-navy-card',
    icon: 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-rose-500/10',
    glow: 'shadow-rose-500/5',
    empty: 'text-rose-400/60',
  },
  emerald: {
    header: 'from-emerald-500/25 via-emerald-600/10 to-navy-card',
    icon: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10',
    glow: 'shadow-emerald-500/5',
    empty: 'text-emerald-400/60',
  },
  cyan: {
    header: 'from-cyan-500/25 via-cyan-600/10 to-navy-card',
    icon: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-cyan-500/10',
    glow: 'shadow-cyan-500/5',
    empty: 'text-cyan-400/60',
  },
};

export function DashboardPanel({
  title,
  subtitle,
  icon: Icon,
  accent = 'amber',
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: Accent;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const style = accents[accent];

  return (
    <div
      className={cn(
        'rounded-2xl border border-navy-border/80 bg-navy-card/90 overflow-hidden',
        'shadow-xl shadow-black/20',
        style.glow,
        className
      )}
    >
      <div
        className={cn(
          'px-4 sm:px-5 py-4 border-b border-navy-border/60',
          'bg-gradient-to-r',
          style.header,
          'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-xl border shadow-lg shrink-0',
              style.icon
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-white text-sm sm:text-base truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function DashboardPanelEmpty({
  message,
  accent = 'amber',
  icon: Icon,
}: {
  message: string;
  accent?: Accent;
  icon?: LucideIcon;
}) {
  const style = accents[accent];
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center">
      {Icon && (
        <div
          className={cn(
            'w-14 h-14 rounded-2xl border flex items-center justify-center mb-3',
            style.icon
          )}
        >
          <Icon className={cn('w-7 h-7', style.empty)} />
        </div>
      )}
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

export function DashboardListItem({
  children,
  accentStripe,
  className,
}: {
  children: ReactNode;
  accentStripe?: string;
  className?: string;
}) {
  return (
    <li
      className={cn(
        'relative px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
        'border-b border-navy-border/40 last:border-0',
        'hover:bg-white/[0.03] transition-colors',
        className
      )}
    >
      {accentStripe && (
        <span
          className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full', accentStripe)}
          aria-hidden
        />
      )}
      {children}
    </li>
  );
}
