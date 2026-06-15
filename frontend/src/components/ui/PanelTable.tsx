import { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

/** White card + gray header + clean rows — matches reseller price tables. */
export function PanelTable({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('overflow-hidden', className)}>{children}</Card>;
}

export function PanelTableHeader({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  trailing,
  actions,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  trailing?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt || title}
            className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : null}
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {trailing ? <span className="text-xs text-gray-500 sm:ml-2 shrink-0">{trailing}</span> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function PanelTableToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelTableScroll({
  children,
  minWidth = 560,
  className,
}: {
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const panelTableHeadClass = 'bg-white border-b border-gray-100';

export function panelTableTh(accent?: 'emerald' | 'violet' | 'amber' | 'blue') {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'violet'
        ? 'text-violet-700'
        : accent === 'amber'
          ? 'text-amber-700'
          : accent === 'blue'
            ? 'text-blue-700'
            : 'text-gray-500';
  return cn('text-left px-4 py-3 font-medium', accentClass);
}

export const panelTableRowClass =
  'border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors';

export const panelTableCellClass = 'px-4 py-3';

export function PanelTableEmpty({
  message,
  icon,
  className,
}: {
  message: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-10 flex flex-col items-center text-center', className)}>
      {icon}
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
