import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  getEffectiveBasePrice,
  getEffectiveMaxPrice,
  getParentAssignedPrice,
  getParentAssignedMaxPrice,
  getResellerSellPrice,
  getParentAssignableRange,
  validateSubResellerFloor,
  validateFloorMaxRange,
  splitProfitsFromBaseChain,
  computeInheritedMaxMarkup,
  computeSubResellerMaxFromFloor,
} from '../services/subResellerPricingService';
import type { IUser } from '../models/User';

function mockReseller(overrides: Partial<IUser['resellerStore']> = {}): IUser {
  return {
    resellerStore: {
      storeName: 'Test',
      slug: 'test',
      phone: '0240000000',
      whatsapp: '0240000000',
      supportEmail: 't@test.com',
      isActive: true,
      isVerified: true,
      referralCode: 'RS12345',
      parentAssignedPrices: new Map(),
      parentAssignedMaxPrices: new Map(),
      subResellerDefaultFloors: new Map(),
      subResellerDefaultMaxes: new Map(),
      customPrices: new Map(),
      ...overrides,
    },
  } as IUser;
}

const pkg = { costPrice: 10, resellerBasePrice: 6, maxSellingPrice: 20 };

test('computeInheritedMaxMarkup uses admin max minus API cost', () => {
  assert.equal(computeInheritedMaxMarkup(pkg), 10);
});

test('computeSubResellerMaxFromFloor adds inherited markup to base', () => {
  assert.equal(computeSubResellerMaxFromFloor(15, pkg), 25);
  assert.equal(computeSubResellerMaxFromFloor(18, pkg), 28);
});

test('getEffectiveBasePrice uses admin base when no parent assignment', () => {
  const user = mockReseller();
  assert.equal(getEffectiveBasePrice(user, 'pkg1', pkg), 6);
});

test('getEffectiveBasePrice uses parentAssignedPrices when set', () => {
  const user = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 8]]),
  });
  assert.equal(getEffectiveBasePrice(user, 'pkg1', pkg), 8);
});

test('getEffectiveMaxPrice uses admin max when no assignment or custom price', () => {
  const user = mockReseller();
  assert.equal(getEffectiveMaxPrice(user, 'pkg1', pkg), 20);
});

test('getEffectiveMaxPrice derives max from assigned base + inherited markup', () => {
  const user = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 15]]),
  });
  assert.equal(getEffectiveMaxPrice(user, 'pkg1', pkg), 25);
});

test('getEffectiveMaxPrice uses admin max for top-level reseller even with custom sell price', () => {
  const user = mockReseller({
    customPrices: new Map([['pkg1', 18]]),
  });
  assert.equal(getEffectiveMaxPrice(user, 'pkg1', pkg), 20);
});

test('getResellerSellPrice prefers custom price over effective base', () => {
  const user = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 8]]),
    customPrices: new Map([['pkg1', 10]]),
  });
  assert.equal(getResellerSellPrice(user, 'pkg1', pkg), 10);
});

test('getResellerSellPrice falls back to effective base', () => {
  const user = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 8]]),
  });
  assert.equal(getResellerSellPrice(user, 'pkg1', pkg), 8);
});

test('getParentAssignableRange exposes inherited markup', () => {
  const parent = mockReseller({ customPrices: new Map([['pkg1', 18]]) });
  const range = getParentAssignableRange(parent, 'pkg1', pkg);
  assert.equal(range.parentCost, 6);
  assert.equal(range.maxCeiling, 20);
  assert.equal(range.inheritedMarkup, 10);
});

test('validateSubResellerFloor rejects base below parent cost', () => {
  assert.throws(() => validateSubResellerFloor(5, 6, 20), /below your cost/i);
});

test('validateSubResellerFloor rejects base above parent max sell price', () => {
  assert.throws(() => validateSubResellerFloor(21, 6, 20), /maximum selling price/i);
});

test('validateFloorMaxRange rejects max below floor', () => {
  assert.throws(() => validateFloorMaxRange(8, 7, 6, 20), /below floor/i);
});

test('splitProfitsFromBaseChain: 3-tier example from plan', () => {
  const idA = new mongoose.Types.ObjectId();
  const idB = new mongoose.Types.ObjectId();
  const idC = new mongoose.Types.ObjectId();
  const chain = [{ _id: idC }, { _id: idB }, { _id: idA }];
  const bases = [9, 8, 6];

  const { leafProfit, uplineProfits } = splitProfitsFromBaseChain(11, chain, bases);

  assert.equal(leafProfit, 2);
  assert.equal(uplineProfits.length, 2);
  assert.equal(uplineProfits[0]!.resellerId.toString(), idB.toString());
  assert.equal(uplineProfits[0]!.profit, 1);
  assert.equal(uplineProfits[1]!.resellerId.toString(), idA.toString());
  assert.equal(uplineProfits[1]!.profit, 2);
});

test('getParentAssignedPrice reads from map', () => {
  const user = mockReseller({
    parentAssignedPrices: new Map([['abc', 7.5]]),
  });
  assert.equal(getParentAssignedPrice(user, 'abc'), 7.5);
  assert.equal(getParentAssignedPrice(user, 'missing'), undefined);
});

test('getParentAssignedMaxPrice reads from map', () => {
  const user = mockReseller({
    parentAssignedMaxPrices: new Map([['abc', 11]]),
  });
  assert.equal(getParentAssignedMaxPrice(user, 'abc'), 11);
});

test('3-tier cascade: grandchild max grows with assigned base + same markup', () => {
  const grandparent = mockReseller({ customPrices: new Map([['pkg1', 18]]) });
  const parent = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 8]]),
  });
  assert.equal(getParentAssignableRange(grandparent, 'pkg1', pkg).maxCeiling, 20);
  assert.equal(getEffectiveMaxPrice(parent, 'pkg1', pkg), 18);
  const child = mockReseller({
    parentAssignedPrices: new Map([['pkg1', 15]]),
  });
  assert.equal(getEffectiveMaxPrice(child, 'pkg1', pkg), 25);
});
