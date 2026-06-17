import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferOrderStatusFromProvider,
  isValidOrderStatus,
  normalizeOrderStatus,
} from '../utils/orderStatus';

describe('orderStatus', () => {
  it('accepts valid order statuses', () => {
    assert.equal(isValidOrderStatus('processing'), true);
    assert.equal(isValidOrderStatus(''), false);
    assert.equal(isValidOrderStatus(null), false);
  });

  it('infers processing from gateway provider states', () => {
    assert.equal(inferOrderStatusFromProvider('gateway_processing'), 'processing');
    assert.equal(inferOrderStatusFromProvider('submitting_to_api'), 'processing');
  });

  it('defaults missing status to pending', () => {
    assert.equal(normalizeOrderStatus(undefined, undefined), 'pending');
    assert.equal(normalizeOrderStatus(null, 'gateway_processing'), 'processing');
    assert.equal(normalizeOrderStatus('delivered', undefined), 'delivered');
  });
});
