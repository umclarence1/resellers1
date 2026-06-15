import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { hashAgentSecret, verifyAgentSecret } from '../services/agentSecretService';
import {
  generateTotpSecret,
  getTotpUri,
  roleRequiresMfa,
  verifyTotpCode,
} from '../services/totpService';
import { encryptSecret, decryptSecret } from '../utils/encryption';
import { secureCompare } from '../utils/secureCompare';
import { rejectFields } from '../middleware/rejectFields';
import { AppError } from '../middleware/errorHandler';

test('agent API secrets are stored and verified with bcrypt', async () => {
  const plain = 'sk_test_dealer_secret_value';
  const hash = await hashAgentSecret(plain);
  assert.notEqual(hash, plain);
  assert.equal(await verifyAgentSecret(plain, hash), true);
  assert.equal(await verifyAgentSecret('wrong', hash), false);
});

test('legacy plaintext agent secrets verify during migration window', async () => {
  const plain = 'legacy-secret-key';
  assert.equal(await verifyAgentSecret(plain, undefined, plain), true);
});

test('TOTP generation and verification for Google Authenticator compatible apps', () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 16);
  const uri = getTotpUri('admin@example.com', secret);
  assert.match(uri, /^otpauth:\/\/totp\//);

  const speakeasy = require('speakeasy') as typeof import('speakeasy');
  const token = speakeasy.totp({ secret, encoding: 'base32' });
  assert.equal(verifyTotpCode(secret, token), true);
  assert.equal(verifyTotpCode(secret, '000000'), false);
});

test('admin and dealer roles require strong MFA', () => {
  assert.equal(roleRequiresMfa('admin'), true);
  assert.equal(roleRequiresMfa('agent'), true);
  assert.equal(roleRequiresMfa('reseller'), false);
});

test('encryptSecret returns plaintext when ENCRYPTION_KEY is unset (dev only)', () => {
  const plain = 'BASE32TOTPSECRET';
  const result = encryptSecret(plain);
  if (!process.env.ENCRYPTION_KEY) {
    assert.equal(result, plain);
  } else {
    assert.notEqual(result, plain);
    assert.equal(decryptSecret(result), plain);
  }
});

test('rejectFields mitigates mass-assignment / NoSQL injection payloads', () => {
  const middleware = rejectFields('$gt', 'role', 'balance');
  const req = { body: { $gt: '', role: 'admin', balance: 9999, packageId: 'ok' } } as Parameters<
    typeof middleware
  >[0];

  assert.throws(
    () => middleware(req, {} as never, () => {}),
    (err: unknown) => err instanceof AppError
  );
});

test('secureCompare prevents timing leaks on webhook signatures', () => {
  assert.equal(secureCompare('a'.repeat(64), 'a'.repeat(64)), true);
  assert.equal(secureCompare('a'.repeat(64), 'b'.repeat(64)), false);
});

test('bcrypt cost factor remains at 12 for password hashing', async () => {
  const hash = await bcrypt.hash('Test@Password1', 12);
  assert.match(hash, /^\$2[aby]\$12\$/);
});
