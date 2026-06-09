import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  to?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BrandLogo({ to = '/', size = 'md', className }: BrandLogoProps) {
  const sizeClass = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  return (
    <Link to={to} className={cn('inline-flex items-center', className)}>
      <span className={cn('font-bold text-white tracking-tight', sizeClass)}>
        Data<span className="text-gold">Bundle</span>
      </span>
    </Link>
  );
}
