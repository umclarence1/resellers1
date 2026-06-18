import { Package, Network, ProductType } from '../models/Package';
import { AFA_BUNDLE_SIZE } from '../config/afa';

/** Legacy packages were keyed by network+bundleSize only — backfill productType before seeding. */
export async function backfillPackageProductTypes(): Promise<void> {
  const result = await Package.collection.updateMany(
    {
      $and: [
        { $or: [{ productType: { $exists: false } }, { productType: null }] },
        { bundleSize: { $ne: AFA_BUNDLE_SIZE } },
      ],
    },
    { $set: { productType: 'data' } }
  );

  const afaResult = await Package.collection.updateMany(
    {
      bundleSize: AFA_BUNDLE_SIZE,
      $or: [{ productType: { $exists: false } }, { productType: null }],
    },
    { $set: { productType: 'afa' } }
  );

  const updated = (result.modifiedCount ?? 0) + (afaResult.modifiedCount ?? 0);
  if (updated > 0) {
    console.log(`Backfilled productType on ${updated} package(s)`);
  }
}

/** Drop pre-productType unique index so data + AFA packages can coexist. */
export async function ensurePackageIndexes(): Promise<void> {
  const collection = Package.collection;
  let indexes = await collection.indexes();
  const legacy = indexes.find((idx) => idx.name === 'network_1_bundleSize_1');
  if (legacy) {
    await collection.dropIndex('network_1_bundleSize_1');
    console.log('Dropped legacy package index network_1_bundleSize_1');
    indexes = await collection.indexes();
  }

  const hasCompound = indexes.some(
    (idx) =>
      idx.name === 'network_1_bundleSize_1_productType_1' ||
      (idx.key?.network === 1 && idx.key?.bundleSize === 1 && idx.key?.productType === 1)
  );

  if (!hasCompound) {
    await collection.createIndex(
      { network: 1, bundleSize: 1, productType: 1 },
      { unique: true, name: 'network_1_bundleSize_1_productType_1' }
    );
    console.log('Created compound unique index on network+bundleSize+productType');
  }
}

export function dataPackageFilter(network: Network, bundleSize: string) {
  return {
    network,
    bundleSize,
    $or: [{ productType: 'data' as ProductType }, { productType: { $exists: false } }],
  };
}
