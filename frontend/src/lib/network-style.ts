import { cn } from '@/lib/utils';

const NETWORK_STYLES: Record<string, { pill: string; stripe: string; dot: string }> = {
  MTN: {
    pill: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/35',
    stripe: 'bg-yellow-400',
    dot: 'bg-yellow-400',
  },
  Telecel: {
    pill: 'bg-red-500/20 text-red-300 border-red-500/35',
    stripe: 'bg-red-500',
    dot: 'bg-red-500',
  },
  AirtelTigo: {
    pill: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
    stripe: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
};

const DEFAULT = {
  pill: 'bg-gray-500/20 text-gray-300 border-gray-500/35',
  stripe: 'bg-gray-400',
  dot: 'bg-gray-400',
};

export function networkStyle(network: string) {
  return NETWORK_STYLES[network] || DEFAULT;
}

export function networkPillClass(network: string) {
  return cn(
    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border',
    networkStyle(network).pill
  );
}
