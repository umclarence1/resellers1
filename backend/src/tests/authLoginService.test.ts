import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountRoleForPortal,
  matchesLoginPortal,
  normalizeAuthEmail,
  prefersTotpLogin,
} from '../services/authLoginService.js';

test('normalizeAuthEmail trims and lowercases', () => {
  assert.equal(normalizeAuthEmail('  Agent@Example.COM '), 'agent@example.com');
});

test('matchesLoginPortal accepts legacy dealer accounts on agent portal', () => {
  assert.equal(matchesLoginPortal({ role: 'dealer' as 'agent' }, 'agent'), true);
  assert.equal(matchesLoginPortal({ role: 'agent' }, 'agent'), true);
  assert.equal(matchesLoginPortal({ role: 'reseller' }, 'agent'), false);
});

test('accountRoleForPortal maps dealer to agent', () => {
  assert.equal(accountRoleForPortal({ role: 'dealer' as 'agent' }), 'agent');
});

test('prefersTotpLogin requires a configured secret', () => {
  assert.equal(prefersTotpLogin({ totpEnabled: true, totpSecretEnc: undefined }), false);
  assert.equal(prefersTotpLogin({ totpEnabled: false, totpSecretEnc: 'enc' }), false);
});
