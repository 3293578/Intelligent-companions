import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicApiPath, scopedMemoryId } from '../src/apiAccess.js';

test('only liveness, readiness, and auth lifecycle APIs stay public', () => {
  for (const path of ['/api/health', '/api/health/ready', '/api/auth/status', '/api/auth/confirm', '/api/billing/paddle/webhook']) {
    assert.equal(isPublicApiPath(path), true, path);
  }
  for (const path of ['/api/chat', '/api/model', '/api/memory/c1', '/api/translate', '/api/language-assist', '/api/content', '/api/status', '/api/billing/checkout']) {
    assert.equal(isPublicApiPath(path), false, path);
  }
});

test('memory storage keys are isolated by authenticated user without exposing raw ids', () => {
  const one = scopedMemoryId('user-one', 'companion_shared');
  const two = scopedMemoryId('user-two', 'companion_shared');
  assert.notEqual(one, two);
  assert.match(one, /^u_[a-f0-9]{32}:companion_shared$/);
  assert.doesNotMatch(one, /user-one/);
  assert.throws(() => scopedMemoryId('', 'companion_shared'), /invalid_user/);
  assert.throws(() => scopedMemoryId('user-one', '../escape'), /invalid_companion/);
});
