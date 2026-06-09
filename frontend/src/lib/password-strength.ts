export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  label: string;
  percent: number;
  barColor: string;
  textColor: string;
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { level: 'empty', label: '', percent: 0, barColor: 'bg-gray-200', textColor: 'text-gray-500' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { level: 'weak', label: 'Weak', percent: 25, barColor: 'bg-red-500', textColor: 'text-red-600' };
  }
  if (score <= 3) {
    return { level: 'fair', label: 'Fair', percent: 50, barColor: 'bg-orange-500', textColor: 'text-orange-600' };
  }
  if (score <= 4) {
    return { level: 'good', label: 'Good', percent: 75, barColor: 'bg-yellow-500', textColor: 'text-yellow-600' };
  }
  return { level: 'strong', label: 'Strong', percent: 100, barColor: 'bg-green-500', textColor: 'text-green-600' };
}

export function isStrongPassword(password: string): boolean {
  return getPasswordStrength(password).level === 'strong' || getPasswordStrength(password).level === 'good';
}
