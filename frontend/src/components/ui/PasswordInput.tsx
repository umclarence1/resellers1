import Input from '@/components/ui/Input';
import { getPasswordStrength } from '@/lib/password-strength';
import { InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  value: string;
  showStrength?: boolean;
}

export default function PasswordInput({
  label,
  error,
  value,
  showStrength = false,
  ...props
}: PasswordInputProps) {
  const strength = showStrength ? getPasswordStrength(value) : null;

  return (
    <div>
      <Input label={label} type="password" value={value} error={error} {...props} />
      {showStrength && value && strength && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${strength.barColor}`}
              style={{ width: `${strength.percent}%` }}
            />
          </div>
          <p className={`mt-1 text-xs font-medium ${strength.textColor}`}>
            Password strength: {strength.label}
          </p>
        </div>
      )}
    </div>
  );
}
