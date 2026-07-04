import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareBundleSizes,
  parseBundleSizeMb,
  sortPackagesByBundleSize,
} from '../utils/bundleSize.js';

test('parseBundleSizeMb parses GB and MB labels', () => {
  assert.equal(parseBundleSizeMb('10GB'), 10240);
  assert.equal(parseBundleSizeMb('35GB'), 35840);
  assert.equal(parseBundleSizeMb('500MB'), 500);
});

test('compareBundleSizes sorts bundles numerically', () => {
  const sizes = ['10GB', '15GB', '20GB', '25GB', '30GB', '40GB', '50GB', '35GB', '45GB', '100GB', '150GB'];
  assert.deepEqual([...sizes].sort(compareBundleSizes), [
    '10GB',
    '15GB',
    '20GB',
    '25GB',
    '30GB',
    '35GB',
    '40GB',
    '45GB',
    '50GB',
    '100GB',
    '150GB',
  ]);
});

test('sortPackagesByBundleSize orders packages within a network', () => {
  const sorted = sortPackagesByBundleSize([
    { network: 'Telecel', bundleSize: '50GB', sortOrder: 99 },
    { network: 'Telecel', bundleSize: '35GB', sortOrder: 100 },
    { network: 'Telecel', bundleSize: '10GB', sortOrder: 1 },
  ]);
  assert.deepEqual(
    sorted.map((p) => p.bundleSize),
    ['10GB', '35GB', '50GB']
  );
});
