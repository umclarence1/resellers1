import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  to?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      topdeals<span className="text-gold">gh</span>
    </span>
  );
}

export default function BrandLogo({ to = '/', size = 'md', className }: BrandLogoProps) {
  const sizeClass = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  return (
    <Link to={to} className={cn('inline-flex items-center', className)}>
      <BrandMark className={cn('font-bold text-white tracking-tight', sizeClass)} />
    </Link>
  );
}
