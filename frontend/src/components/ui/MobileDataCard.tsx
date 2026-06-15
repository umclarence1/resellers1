import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MobileDataCardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('md:hidden divide-y divide-gray-100', className)}>
      {children}
    </ul>
  );
}

export function MobileDataCard({
  children,
  actions,
  leading,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn('p-4 flex flex-col gap-3', className)}>
      <div className="flex gap-3 min-w-0">
        {leading && <div className="shrink-0 pt-0.5">{leading}</div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  );
}

export function MobileDataCardRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 text-sm', className)}>
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right min-w-0 break-words">{value}</span>
    </div>
  );
}
