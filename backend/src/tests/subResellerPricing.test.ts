import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  getEffectiveBasePrice,
  getParentAssignedPrice,
  getResellerSellPrice,
  splitProfitsFromBaseChain,
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
      customPrices: new Map(),
      ...overrides,
    },
  } as IUser;
}

const pkg = { resellerBasePrice: 6, maxSellingPrice: 12 };

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
