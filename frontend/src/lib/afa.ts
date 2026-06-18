export const AFA_CHECK_USSD = '*1848#';
export const AFA_PROCESSING_HOURS = 24;
export const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

export function formatGhanaCardInput(value: string): string {
  const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (upper.startsWith('GHA')) return upper.slice(0, 14);
  if (upper.startsWith('G')) return upper.slice(0, 14);
  return upper.slice(0, 14);
}

export function isValidGhanaCard(value: string): boolean {
  return GHANA_CARD_REGEX.test(value.trim().toUpperCase());
}
