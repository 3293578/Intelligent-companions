import test from 'node:test';
import assert from 'node:assert/strict';

import { clientIpFromRequest, createApiUsageLimiter, isMeteredApiPath } from '../src/apiRateLimit.js';

test('metered routes cover every hosted model and external content operation', () => {
  for (const path of ['/api/chat', '/api/translate', '/api/language-assist', '/api/content']) {
    assert.equal(isMeteredApiPath(path), true);
  }
  for (const variant of ['/api/chat/', '/api/chat-bypass', '/api/translate/']) {
    assert.equal(isMeteredApiPath(variant), false);
  }
  assert.equal(isMeteredApiPath('/api/health'), false);
});

test('usage limiter enforces both user and client-IP windows plus a daily ceiling', () => {
  let now = 1_000;
  const limiter = createApiUsageLimiter({
    now: () => now,
    userMinuteLimit: 2,
    ipMinuteLimit: 3,
    userDailyLimit: 4
  });
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).allowed, true);
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).allowed, true);
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).allowed, false);
  now += 60_001;
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).allowed, true);
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).allowed, true);
  now += 60_001;
  assert.equal(limiter.consume({ userId: 'u1', ip: '1.1.1.1' }).reason, 'daily_limit');
});

test('trusted proxy mode accepts only a valid first forwarded client address', () => {
  const request = {
    headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' },
    socket: { remoteAddress: '10.0.0.3' }
  };
  assert.equal(clientIpFromRequest(request, { trustProxy: true }), '203.0.113.8');
  assert.equal(clientIpFromRequest(request, { trustProxy: false }), '10.0.0.3');
  request.headers['x-forwarded-for'] = 'not-an-ip';
  assert.equal(clientIpFromRequest(request, { trustProxy: true }), '10.0.0.3');
});
