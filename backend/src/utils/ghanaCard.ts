/** Ghana Card format: GHA-123456789-0 */
export const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

export function normalizeGhanaCard(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGhanaCard(value: string): boolean {
  return GHANA_CARD_REGEX.test(normalizeGhanaCard(value));
}
