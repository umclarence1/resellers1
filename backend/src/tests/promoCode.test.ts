import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Package } from '../models/Package.js';
import { PromoCode } from '../models/PromoCode.js';
import { User } from '../models/User.js';
import {
  computeStoreCheckoutTotals,
  generatePromoCodes,
  hashPromoCode,
  normalizePromoCode,
  redeemPromoCode,
  validatePromoForCheckout,
  PROMO_INVALID_MESSAGE,
} from '../services/promoCodeService.js';

let mongo: MongoMemoryServer;
let packageId: string;
let adminId: string;
let sampleCode: string;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const admin = await User.create({
    fullName: 'Admin',
    email: 'admin-promo@test.com',
    phone: '0240000001',
    password: 'hashed',
    role: 'admin',
    status: 'active',
  });
  adminId = admin._id.toString();

  const pkg = await Package.create({
    network: 'Telecel',
    productType: 'data',
    bundleSize: '1GB',
    costPrice: 3,
    agentPrice: 4,
    resellerBasePrice: 5,
    maxSellingPrice: 10,
    isEnabled: true,
    sortOrder: 1,
  });
  packageId = pkg._id.toString();
});

test.after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test.beforeEach(async () => {
  await PromoCode.deleteMany({});
  const generated = await generatePromoCodes({
    discountGhs: 2,
    count: 3,
    adminId,
    label: 'Test batch',
  });
  sampleCode = generated.codes[0];
});

test('normalizePromoCode trims and uppercases', () => {
  assert.equal(normalizePromoCode(' td-abc12345 '), 'TD-ABC12345');
});

test('computeStoreCheckoutTotals applies fixed GHS discount and fee', () => {
  const totals = computeStoreCheckoutTotals(10, 2, 2);
  assert.equal(totals.originalSellingPrice, 10);
  assert.equal(totals.discountedSellingPrice, 8);
  assert.equal(totals.discountGhs, 2);
  assert.equal(totals.processingFee, 0.16);
  assert.equal(totals.total, 8.16);
});

test('validatePromoForCheckout accepts valid code for any package', async () => {
  const result = await validatePromoForCheckout({
    code: sampleCode,
    packageId,
    sellingPrice: 8,
    paystackChargePercent: 2,
  });
  assert.equal(result.discountGhs, 2);
  assert.equal(result.discountedSellingPrice, 6);
  assert.ok(result.promoCodeId);
});

test('validatePromoForCheckout works on a different package', async () => {
  const other = await Package.create({
    network: 'MTN',
    productType: 'data',
    bundleSize: '2GB',
    costPrice: 5,
    agentPrice: 6,
    resellerBasePrice: 7,
    maxSellingPrice: 12,
    isEnabled: true,
    sortOrder: 2,
  });

  const result = await validatePromoForCheckout({
    code: sampleCode,
    packageId: other._id.toString(),
    sellingPrice: 10,
    paystackChargePercent: 2,
  });
  assert.equal(result.discountGhs, 2);
  assert.equal(result.discountedSellingPrice, 8);
});

test('redeemPromoCode is single-use', async () => {
  const validated = await validatePromoForCheckout({
    code: sampleCode,
    packageId,
    sellingPrice: 8,
    paystackChargePercent: 2,
  });

  await redeemPromoCode({
    promoCodeId: validated.promoCodeId,
    paystackReference: 'ref-1',
    orderId: 'ORD-1',
    email: 'buyer@test.com',
  });

  await assert.rejects(
    () =>
      redeemPromoCode({
        promoCodeId: validated.promoCodeId,
        paystackReference: 'ref-2',
        orderId: 'ORD-2',
        email: 'buyer2@test.com',
      }),
    /could not be redeemed/
  );
});

test('used code fails validation', async () => {
  const validated = await validatePromoForCheckout({
    code: sampleCode,
    packageId,
    sellingPrice: 8,
    paystackChargePercent: 2,
  });

  await redeemPromoCode({
    promoCodeId: validated.promoCodeId,
    paystackReference: 'ref-used',
    orderId: 'ORD-USED',
  });

  await assert.rejects(
    () =>
      validatePromoForCheckout({
        code: sampleCode,
        packageId,
        sellingPrice: 8,
        paystackChargePercent: 2,
      }),
    (err: Error) => err.message === PROMO_INVALID_MESSAGE
  );
});

test('hashPromoCode is deterministic', () => {
  const a = hashPromoCode('TD-ABCDEFGH');
  const b = hashPromoCode('TD-ABCDEFGH');
  assert.equal(a, b);
  assert.notEqual(a, hashPromoCode('TD-ABCDEFGI'));
});

test('generatePromoCodes stores hashes not plaintext', async () => {
  const generated = await generatePromoCodes({
    discountGhs: 1,
    count: 2,
    adminId,
  });

  const stored = await PromoCode.find({ batchId: generated.batchId }).lean();
  assert.equal(stored.length, 2);
  assert.equal(generated.scope, 'all_products');
  for (const row of stored) {
    assert.ok(!generated.codes.includes(row.codeHash));
    assert.equal(row.codeHash, hashPromoCode(normalizePromoCode(generated.codes.find((c) => c.endsWith(row.codeLast4))!)));
    assert.equal(row.packageId, undefined);
  }
});
