import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { createBillingRouteHandler } from '../src/billingRoutes.js';

const USER_ID = '759e34ad-f590-4866-9638-d93b8838f8fe';

test('checkout route derives identity from the authenticated session, not request input', async () => {
  const calls = [];
  const handler = createBillingRouteHandler({
    billingClient: {
      async createCheckout(input) {
        calls.push(input);
        return { transactionId: 'txn_01h00000000000000000000000' };
      }
    },
    commerceClient: {},
    webhookSecret: 'pdl_ntfset_test_secret'
  });
  const result = await handler.checkout({
    authenticatedUser: { id: USER_ID },
    body: { plan: 'standard', userId: 'attacker-controlled' }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(calls[0], { userId: USER_ID, plan: 'standard' });
  assert.equal(result.body.transactionId, 'txn_01h00000000000000000000000');
});

test('webhook route verifies the raw body before synchronizing subscription state', async () => {
  const secret = 'pdl_ntfset_test_secret';
  const event = {
    event_id: 'evt_01h00000000000000000000000',
    event_type: 'subscription.created',
    occurred_at: '2026-08-27T05:00:00Z',
    data: {
      id: 'sub_01h00000000000000000000000',
      customer_id: 'ctm_01h00000000000000000000000',
      status: 'active',
      current_billing_period: { starts_at: '2026-08-27T05:00:00Z', ends_at: '2026-09-27T05:00:00Z' },
      custom_data: { wyth_user_id: USER_ID, wyth_plan: 'standard' }
    }
  };
  const rawBody = JSON.stringify(event);
  const timestamp = 1_800_000_000;
  const signature = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex');
  const applied = [];
  const handler = createBillingRouteHandler({
    billingClient: {},
    commerceClient: { async applyPaddleSubscriptionEvent(value) { applied.push(value); return true; } },
    webhookSecret: secret,
    now: () => timestamp * 1000
  });
  const result = await handler.webhook({ rawBody, signatureHeader: `ts=${timestamp};h1=${signature}` });
  assert.equal(result.status, 200);
  assert.equal(result.body.applied, true);
  assert.equal(applied[0].userId, USER_ID);
});

test('billing routes fail closed when not configured and sanitize provider failures', async () => {
  const handler = createBillingRouteHandler();
  assert.equal((await handler.checkout({ authenticatedUser: { id: USER_ID }, body: { plan: 'standard' } })).status, 503);
  assert.equal((await handler.webhook({ rawBody: '{}', signatureHeader: '' })).status, 503);
});

test('checkout route records only allowlisted provider diagnostics', async () => {
  const diagnostics = [];
  const handler = createBillingRouteHandler({
    billingClient: {
      async createCheckout() {
        throw Object.assign(new Error('provider detail'), {
          providerStatus: 400,
          providerCode: 'transaction_checkout_url_domain_is_not_approved',
          secret: 'must-not-be-logged'
        });
      }
    },
    commerceClient: {},
    webhookSecret: 'pdl_ntfset_test_secret',
    onDiagnostic(value) { diagnostics.push(value); }
  });
  const result = await handler.checkout({ authenticatedUser: { id: USER_ID }, body: { plan: 'standard' } });
  assert.deepEqual(result, { status: 503, body: { error: 'billing_domain_pending', retryable: false } });
  assert.deepEqual(diagnostics, [{
    category: 'checkout',
    providerStatus: 400,
    providerCode: 'transaction_checkout_url_domain_is_not_approved'
  }]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /provider detail|must-not-be-logged/);
});

test('checkout route explains when Paddle seller onboarding has not enabled checkout', async () => {
  const handler = createBillingRouteHandler({
    billingClient: {
      async createCheckout() {
        throw Object.assign(new Error('provider detail'), {
          providerStatus: 400,
          providerCode: 'transaction_checkout_not_enabled'
        });
      }
    },
    commerceClient: {},
    webhookSecret: 'pdl_ntfset_test_secret'
  });
  const result = await handler.checkout({ authenticatedUser: { id: USER_ID }, body: { plan: 'standard' } });
  assert.deepEqual(result, { status: 503, body: { error: 'billing_onboarding_incomplete', retryable: false } });
});

test('checkout route keeps unknown provider failures generic', async () => {
  const handler = createBillingRouteHandler({
    billingClient: { async createCheckout() { throw new Error('provider detail'); } },
    commerceClient: {},
    webhookSecret: 'pdl_ntfset_test_secret'
  });
  const result = await handler.checkout({ authenticatedUser: { id: USER_ID }, body: { plan: 'standard' } });
  assert.deepEqual(result, { status: 503, body: { error: 'billing_unavailable', retryable: true } });
});
