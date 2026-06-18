export const AFA_BUNDLE_SIZE = 'AFA Registration';
export const AFA_BASE_PRICE = 15;
export const AFA_DEFAULT_MAX_SELL = 25;
export const AFA_DEFAULT_IMAGE = '/images/afa.jpg';
export const AFA_CHECK_USSD = '*1848#';
export const AFA_PROCESSING_HOURS = 24;

export type ProductType = 'data' | 'afa';

export function isAfaProduct(productType?: string, bundleSize?: string): boolean {
  return productType === 'afa' || bundleSize === AFA_BUNDLE_SIZE;
}
