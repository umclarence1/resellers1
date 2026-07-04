export function parseBundleSizeMb(bundleSize: string): number {
  const raw = String(bundleSize || '').trim().toUpperCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(GB|MB)?$/);
  if (!match) {
    const fallback = raw.match(/(\d+(?:\.\d+)?)/);
    if (fallback) return parseFloat(fallback[1]) * 1024;
    return Number.MAX_SAFE_INTEGER;
  }
  const value = parseFloat(match[1]);
  const unit = match[2] || 'GB';
  return unit === 'MB' ? value : value * 1024;
}

export function compareBundleSizes(a: string, b: string): number {
  const diff = parseBundleSizeMb(a) - parseBundleSizeMb(b);
  if (diff !== 0) return diff;
  return a.localeCompare(b);
}

export function sortPackagesByBundleSize<
  T extends { bundleSize: string; network?: string; sortOrder?: number },
>(packages: T[]): T[] {
  return [...packages].sort((a, b) => {
    if (a.network && b.network && a.network !== b.network) {
      return a.network.localeCompare(b.network);
    }
    const sizeDiff = compareBundleSizes(a.bundleSize, b.bundleSize);
    if (sizeDiff !== 0) return sizeDiff;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}
