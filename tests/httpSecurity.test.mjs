import test from 'node:test';
import assert from 'node:assert/strict';

import { createSecurityHeaders } from '../src/httpSecurity.js';

test('all responses receive a restrictive browser security policy', () => {
  const headers = createSecurityHeaders();
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['content-security-policy'], /default-src 'self'/);
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal('strict-transport-security' in headers, false);
});

test('production HTTPS responses opt into transport security without exposing configuration', () => {
  const headers = createSecurityHeaders({ production: true });
  assert.equal(headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
  assert.doesNotMatch(JSON.stringify(headers), /api[_-]?key|secret|token/i);
});
