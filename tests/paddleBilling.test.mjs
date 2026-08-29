import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
  createPaddleBillingClient,
  normalizePaddleSubscriptionEvent,
  verifyPaddleWebhook
} from '../src/paddleBilling.js';

const userId = '759e34ad-f590-4866-9638-d93b8838f8fe';

test('Paddle checkout accepts only the server-owned plan catalog and trusted user metadata', async () => {
  const calls = [];
  const client = createPaddleBillingClient({
    apiKey: 'test-paddle-api-key-not-a-real-secret',
    environment: 'sandbox',
    checkoutUrl: 'https://staging.thewyth.com/billing',
    priceIds: {
      standard: 'pri_01kzszqc8792n88p0c90jd5r8c',
      unlimited: 'pri_01kzszytcn2m8wdsgbqeasyrbh'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        data: {
          id: 'txn_01h00000000000000000000000',
          checkout: { url: 'https://staging.thewyth.com/?billing=return&_ptxn=txn_01h00000000000000000000000' }
        }
      }), { status: 201, headers: { 'content-type': 'application/json' } });
    }
  });

  const checkout = await client.createCheckout({ userId, plan: 'standard' });
  assert.deepEqual(checkout, { transactionId: 'txn_01h00000000000000000000000' });
  assert.equal(calls[0].url, 'https://sandbox-api.paddle.com/transactions');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-paddle-api-key-not-a-real-secret');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.items, [{ price_id: 'pri_01kzszqc8792n88p0c90jd5r8c', quantity: 1 }]);
  assert.deepEqual(body.custom_data, { wyth_user_id: userId, wyth_plan: 'standard' });
  assert.equal(body.checkout.url, 'https://staging.thewyth.com/billing');

  await assert.rejects(() => client.createCheckout({ userId, plan: 'admin' }), /invalid_plan/);
});

test('Paddle checkout ignores provider redirect URLs and trusts only the transaction ID', async () => {
  const client = createPaddleBillingClient({
    apiKey: 'test-paddle-api-key-not-a-real-secret',
    environment: 'sandbox',
    checkoutUrl: 'https://staging.thewyth.com/billing',
    priceIds: {
      standard: 'pri_01kzszqc8792n88p0c90jd5r8c',
      unlimited: 'pri_01kzszytcn2m8wdsgbqeasyrbh'
    },
    fetchImpl: async () => new Response(JSON.stringify({
      data: {
        id: 'txn_01h00000000000000000000000',
        checkout: { url: 'https://attacker.example/collect' }
      }
    }), { status: 201, headers: { 'content-type': 'application/json' } })
  });

  assert.deepEqual(await client.createCheckout({ userId, plan: 'standard' }), {
    transactionId: 'txn_01h00000000000000000000000'
  });
});

test('Paddle checkout preserves only a safe provider diagnostic code', async () => {
  const client = createPaddleBillingClient({
    apiKey: 'test-paddle-api-key-not-a-real-secret',
    environment: 'sandbox',
    checkoutUrl: 'https://staging.thewyth.com/',
    priceIds: {
      standard: 'pri_01kzszqc8792n88p0c90jd5r8c',
      unlimited: 'pri_01kzszytcn2m8wdsgbqeasyrbh'
    },
    fetchImpl: async () => new Response(JSON.stringify({
      error: {
        code: 'transaction_checkout_url_domain_is_not_approved',
        detail: 'secret provider detail must not escape'
      }
    }), { status: 400, headers: { 'content-type': 'application/json' } })
  });
  await assert.rejects(
    () => client.createCheckout({ userId, plan: 'standard' }),
    (error) => error.providerCode === 'transaction_checkout_url_domain_is_not_approved'
      && error.providerStatus === 400
      && !JSON.stringify(error).includes('secret provider detail')
  );
});

test('Paddle webhook verification uses the unchanged raw body and rejects stale or altered messages', () => {
  const secret = 'pdl_ntfset_test_secret';
  const rawBody = JSON.stringify({ event_id: 'evt_01h00000000000000000000000', event_type: 'subscription.updated' });
  const nowSeconds = 1_800_000_000;
  const signature = createHmac('sha256', secret).update(`${nowSeconds}:${rawBody}`, 'utf8').digest('hex');
  const header = `ts=${nowSeconds};h1=${signature}`;

  assert.deepEqual(verifyPaddleWebhook({ rawBody, signatureHeader: header, secret, now: () => nowSeconds * 1000 }), {
    event_id: 'evt_01h00000000000000000000000',
    event_type: 'subscription.updated'
  });
  assert.throws(
    () => verifyPaddleWebhook({ rawBody: `${rawBody} `, signatureHeader: header, secret, now: () => nowSeconds * 1000 }),
    /invalid_webhook_signature/
  );
  assert.throws(
    () => verifyPaddleWebhook({ rawBody, signatureHeader: header, secret, now: () => (nowSeconds + 301) * 1000 }),
    /stale_webhook/
  );
});

test('Paddle subscription events normalize only trusted server fields', () => {
  const normalized = normalizePaddleSubscriptionEvent({
    event_id: 'evt_01h00000000000000000000000',
    event_type: 'subscription.updated',
    occurred_at: '2026-08-27T05:00:00Z',
    data: {
      id: 'sub_01h00000000000000000000000',
      customer_id: 'ctm_01h00000000000000000000000',
      status: 'active',
      current_billing_period: {
        starts_at: '2026-08-27T05:00:00Z',
        ends_at: '2026-09-27T05:00:00Z'
      },
      scheduled_change: { action: 'cancel', effective_at: '2026-09-27T05:00:00Z' },
      custom_data: {
        wyth_user_id: userId,
        wyth_plan: 'unlimited',
        ignored: '<script>not stored</script>'
      }
    }
  });

  assert.deepEqual(normalized, {
    providerEventId: 'evt_01h00000000000000000000000',
    eventType: 'subscription.updated',
    occurredAt: '2026-08-27T05:00:00.000Z',
    userId,
    providerCustomerId: 'ctm_01h00000000000000000000000',
    providerSubscriptionId: 'sub_01h00000000000000000000000',
    plan: 'unlimited',
    status: 'active',
    currentPeriodStart: '2026-08-27T05:00:00.000Z',
    currentPeriodEnd: '2026-09-27T05:00:00.000Z',
    cancelAtPeriodEnd: true
  });
});
