import { cn } from '@/lib/utils';
import FieldError from '@/components/ui/FieldError';
import { TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, rows = 6, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'w-full px-4 py-3 rounded-lg border bg-white font-mono text-sm leading-relaxed resize-y min-h-[10rem]',
            'text-gray-900 placeholder:text-gray-400',
            'border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition',
            error && 'border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-200',
            className
          )}
          {...props}
        />
        <FieldError id={errorId} message={error} />
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
export default Textarea;
