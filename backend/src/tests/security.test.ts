import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { computeResellerProfit } from '../services/resellerProfitService';
import { rejectFields } from '../middleware/rejectFields';
import { AppError } from '../middleware/errorHandler';
import { verifyToken } from '../utils/jwt';
import { env } from '../config/env';
import { secureCompare } from '../utils/secureCompare';
import { assertPaystackCheckoutUrl } from '../utils/paystack';
import { generateOtpCode } from '../utils/otp';

test('computeResellerProfit never returns negative profit', () => {
  assert.equal(computeResellerProfit(8, 10), 0);
  assert.equal(computeResellerProfit(12, 10), 2);
});

test('rejectFields blocks manipulated pricing fields', () => {
  const middleware = rejectFields('sellingPrice', 'role');
  const req = { body: { packageId: 'x', sellingPrice: 1, role: 'admin' } } as Parameters<typeof middleware>[0];

  assert.throws(
    () => middleware(req, {} as never, () => {}),
    (err: unknown) => err instanceof AppError && err.statusCode === 400
  );
});

test('rejectFields allows valid purchase body', () => {
  const middleware = rejectFields('sellingPrice', 'role');
  const req = { body: { packageId: 'x', recipientPhone: '0241234567' } } as Parameters<typeof middleware>[0];
  let nextCalled = false;

  middleware(req, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('secureCompare rejects mismatched signatures', () => {
  assert.equal(secureCompare('abc', 'abc'), true);
  assert.equal(secureCompare('abc', 'abd'), false);
});

test('assertPaystackCheckoutUrl blocks untrusted hosts', () => {
  assert.throws(() => assertPaystackCheckoutUrl('https://evil.example/phish'));
  assert.doesNotThrow(() => assertPaystackCheckoutUrl('https://checkout.paystack.com/abc'));
});

test('generateOtpCode returns 6 digits', () => {
  const code = generateOtpCode();
  assert.match(code, /^\d{6}$/);
});

test('verifyToken maps expired JWT to 401 AppError', () => {
  const expired = jwt.sign({ userId: 'x', role: 'admin', tokenVersion: 0 }, env.jwtSecret, {
    expiresIn: '-1s',
  });
  assert.throws(
    () => verifyToken(expired),
    (err: unknown) => err instanceof AppError && err.statusCode === 401
  );
});
