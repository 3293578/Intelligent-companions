import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommerceRuntime } from '../src/commerceRuntime.js';

const USER_ID = '759e34ad-f590-4866-9638-d93b8838f8fe';
const REQUEST_ID = 'd32c9d14-a73c-40f6-9ff6-d77dfd54c246';

test('optional staging commerce bypasses safely while required production fails closed', async () => {
  assert.deepEqual(await createCommerceRuntime().checkAccess(USER_ID), {
    allowed: true,
    plan: 'staging_bypass',
    reason: 'commerce_not_enabled'
  });
  assert.deepEqual(await createCommerceRuntime({ required: true }).checkAccess(USER_ID), {
    allowed: false,
    plan: 'none',
    reason: 'commerce_unavailable'
  });
});

test('runtime delegates access and writes priced provider metrics after success', async () => {
  const writes = [];
  const client = {
    async getAccess() {
      return { allowed: true, plan: 'trial_pending', reason: 'first_reply_starts_trial' };
    },
    async recordSuccessfulUse(value) { writes.push(value); }
  };
  const runtime = createCommerceRuntime({ client, now: () => new Date('2026-08-25T10:00:00Z') });
  const access = await runtime.checkAccess(USER_ID);
  await runtime.recordSuccessfulUse({
    userId: USER_ID,
    access,
    requestId: REQUEST_ID,
    operation: 'chat',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    usage: { inputTokens: 1_000_000, cachedInputTokens: 250_000, outputTokens: 100_000 }
  });
  assert.equal(writes[0].startTrial, true);
  assert.equal(writes[0].estimatedCostUsd, 0.1337);
  assert.equal(writes[0].successfulAt, '2026-08-25T10:00:00.000Z');
});
