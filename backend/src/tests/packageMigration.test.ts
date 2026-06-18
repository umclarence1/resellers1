import test from 'node:test';
import assert from 'node:assert/strict';
import { dataPackageFilter } from '../services/packageMigrationService';

test('dataPackageFilter matches legacy packages without productType', () => {
  const filter = dataPackageFilter('MTN', '1GB');
  assert.deepEqual(filter, {
    network: 'MTN',
    bundleSize: '1GB',
    $or: [{ productType: 'data' }, { productType: { $exists: false } }],
  });
});
