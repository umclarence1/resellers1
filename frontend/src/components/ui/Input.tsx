import { cn } from '@/lib/utils';
import FieldError from '@/components/ui/FieldError';
import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
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
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 transition',
            'border-gray-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold',
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
Input.displayName = 'Input';
export default Input;
