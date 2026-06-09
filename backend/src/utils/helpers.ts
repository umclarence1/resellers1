import { v4 as uuidv4 } from 'uuid';

export const generateOrderId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

export const generateReferralCode = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `RS${num}`;
};

export const generateApiKey = (): string => `dbk_${uuidv4().replace(/-/g, '')}`;
export const generateSecretKey = (): string => `dbs_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '').substring(0, 16)}`;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const isValidGhanaPhone = (phone: string): boolean => /^0\d{9}$/.test(phone);

export const parseBundleSize = (input: string): string => {
  const cleaned = input.trim().toUpperCase();
  if (cleaned.endsWith('GB')) return cleaned;
  return `${cleaned}GB`;
};

export const getDateRanges = () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startOfToday, startOfWeek, startOfMonth, now };
};

export const roundMoney = (amount: number): number => Math.round(amount * 100) / 100;
