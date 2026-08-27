import test from 'node:test';
import assert from 'node:assert/strict';

import { createSupabaseCommerceClient } from '../src/supabaseCommerceClient.js';

const USER_ID = '759e34ad-f590-4866-9638-d93b8838f8fe';
const REQUEST_ID = 'd32c9d14-a73c-40f6-9ff6-d77dfd54c246';
const NOW = '2026-08-25T10:00:00.000Z';
const TEST_SECRET = ['sb', 'secret', 'server-only-test-value'].join('_');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  };
}

test('commerce client reads server-owned access with a secret key only in the apikey header', async () => {
  const calls = [];
  const client = createSupabaseCommerceClient({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: TEST_SECRET,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/subscriptions?')) return jsonResponse([]);
      if (url.includes('kind=eq.trial')) return jsonResponse([]);
      if (url.includes('/entitlement_periods?')) {
        return jsonResponse([{ kind: 'trial', starts_at: '2026-08-25T09:00:00Z', ends_at: '2026-08-26T09:00:00Z', credit_usd: 0 }]);
      }
      if (url.endsWith('/rpc/commercial_usage_total')) return jsonResponse(0.25);
      throw new Error(`unexpected request: ${url}`);
    }
  });

  const access = await client.getAccess({ userId: USER_ID, now: NOW });
  assert.equal(access.allowed, true);
  assert.equal(access.plan, 'trial');
  assert.equal(access.usedUsd, 0.25);
  for (const call of calls) {
    assert.equal(call.options.headers.apikey, TEST_SECRET);
    assert.equal(call.options.headers.authorization, undefined);
  }
});

test('a never-tried user may make one first request that starts the trial only after success', async () => {
  const client = createSupabaseCommerceClient({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: TEST_SECRET,
    fetchImpl: async (url) => {
      if (url.includes('/subscriptions?') || url.includes('/entitlement_periods?')) return jsonResponse([]);
      if (url.endsWith('/rpc/commercial_usage_total')) return jsonResponse(0);
      throw new Error(`unexpected request: ${url}`);
    }
  });
  const access = await client.getAccess({ userId: USER_ID, now: NOW });
  assert.equal(access.allowed, true);
  assert.equal(access.plan, 'trial_pending');
  assert.equal(access.reason, 'first_reply_starts_trial');
});

test('successful hosted use grants the trial idempotently and records metrics without content', async () => {
  const calls = [];
  const client = createSupabaseCommerceClient({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: TEST_SECRET,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse([], 201);
    }
  });

  await client.recordSuccessfulUse({
    userId: USER_ID,
    requestId: REQUEST_ID,
    successfulAt: NOW,
    operation: 'chat',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    inputTokens: 120,
    outputTokens: 30,
    estimatedCostUsd: 0.000025,
    startTrial: true,
    forbiddenContent: 'must never be serialized'
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/rpc\/grant_initial_trial$/);
  assert.match(calls[1].url, /\/usage_events$/);
  const serialized = calls.map((call) => call.options.body).join(' ');
  assert.doesNotMatch(serialized, /must never be serialized/);
  assert.match(serialized, new RegExp(REQUEST_ID));
});

test('commerce client rejects invalid identities and sanitizes provider failures', async () => {
  const client = createSupabaseCommerceClient({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: TEST_SECRET,
    fetchImpl: async () => jsonResponse({ message: 'database leaked internal detail' }, 500)
  });
  await assert.rejects(client.getAccess({ userId: 'not-a-uuid', now: NOW }), /invalid_user_id/);
  await assert.rejects(
    client.getAccess({ userId: USER_ID, now: NOW }),
    (error) => error.code === 'commerce_unavailable' && !error.message.includes('leaked')
  );
});

test('commerce client applies normalized Paddle events through one server-only RPC', async () => {
  const calls = [];
  const client = createSupabaseCommerceClient({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: TEST_SECRET,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(true);
    }
  });
  const applied = await client.applyPaddleSubscriptionEvent({
    providerEventId: 'evt_01h00000000000000000000000',
    eventType: 'subscription.updated',
    occurredAt: NOW,
    userId: USER_ID,
    providerCustomerId: 'ctm_01h00000000000000000000000',
    providerSubscriptionId: 'sub_01h00000000000000000000000',
    plan: 'standard',
    status: 'active',
    currentPeriodStart: NOW,
    currentPeriodEnd: '2026-09-25T10:00:00.000Z',
    cancelAtPeriodEnd: false
  });
  assert.equal(applied, true);
  assert.match(calls[0].url, /\/rpc\/apply_paddle_subscription_event$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.p_user_id, USER_ID);
  assert.equal(body.p_plan, 'standard');
  assert.equal(body.p_provider_subscription_id, 'sub_01h00000000000000000000000');
});
