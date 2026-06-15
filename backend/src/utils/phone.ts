import { AppError } from '../middleware/errorHandler';
import { isValidGhanaPhone } from './helpers';

/** Normalize to local Ghana format 0XXXXXXXXX. */
export function normalizeGhanaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }
  if (digits.length === 9) {
    return `0${digits}`;
  }
  throw new AppError('Enter a valid Ghana phone number (e.g. 0241234567)');
}

export function assertGhanaPhone(raw: string): string {
  const phone = normalizeGhanaPhone(raw);
  if (!isValidGhanaPhone(phone)) {
    throw new AppError('Enter a valid Ghana phone number (e.g. 0241234567)');
  }
  return phone;
}
