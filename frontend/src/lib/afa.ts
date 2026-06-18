export const AFA_CHECK_USSD = '*1848#';
export const AFA_PROCESSING_HOURS = 24;
export const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

/** GHA-123456789-0 = 15 characters (3 + 1 + 9 + 1 + 1) */
const GHANA_CARD_MAX_LEN = 15;

export function formatGhanaCardInput(value: string): string {
  const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (upper.startsWith('GHA')) return upper.slice(0, GHANA_CARD_MAX_LEN);
  if (upper.startsWith('G')) return upper.slice(0, GHANA_CARD_MAX_LEN);
  return upper.slice(0, GHANA_CARD_MAX_LEN);
}

export function isValidGhanaCard(value: string): boolean {
  return GHANA_CARD_REGEX.test(value.trim().toUpperCase());
}
