import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderNumber } from '../utils/helpers';

describe('generateOrderNumber', () => {
  it('matches ORD-timestamp-random format', () => {
    const id = generateOrderNumber();
    assert.match(id, /^ORD-\d+-\d+$/);
  });

  it('generates unique values in a batch', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOrderNumber()));
    assert.equal(ids.size, 100);
  });

  it('never returns null, undefined, or empty', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = generateOrderNumber();
      assert.ok(id);
      assert.ok(id.trim().length > 0);
    }
  });
});
