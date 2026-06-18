import { randomUUID } from 'crypto';

export const generateOrderNumber = (): string =>
  `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

/** Public order identifier — same format as orderNumber for legacy DB compatibility. */
export const generateOrderId = (): string => generateOrderNumber();

export const generateReferralCode = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `RS${num}`;
};

export const generateApiKey = (): string => `dbk_${randomUUID().replace(/-/g, '')}`;
export const generateSecretKey = (): string => `dbs_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '').substring(0, 16)}`;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const isValidStoreSlug = (slug: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 64;

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
