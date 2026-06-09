import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  onComplete?: (code: string) => void;
  className?: string;
}

export default function OtpInput({ value, onChange, disabled, onComplete, className }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, raw: string) => {
    if (!/^\d*$/.test(raw)) return;
    const next = [...value];
    next[index] = raw.slice(-1);
    onChange(next);
    if (raw && index < 5) inputs.current[index + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) onComplete?.(code);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    onChange(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) onComplete?.(pasted);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <div className={cn('flex justify-center gap-1.5 min-[360px]:gap-2 sm:gap-3 max-w-full', className)} onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            'w-9 h-12 min-[360px]:w-10 min-[400px]:w-11 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold border-2 rounded-lg sm:rounded-xl',
            'focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 text-gray-900 transition-all',
            digit ? 'border-gold bg-amber-50 shadow-sm shadow-gold/20' : 'border-gray-200 bg-white',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        />
      ))}
    </div>
  );
}
