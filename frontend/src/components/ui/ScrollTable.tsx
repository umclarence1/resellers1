import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function ScrollTable({
  children,
  className,
  hint = 'Swipe to see more →',
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <p className="table-mobile-hint md:hidden">{hint}</p>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        {children}
      </div>
    </div>
  );
}
