import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPaddleCheckoutLauncher,
  publicPaddleClientConfig
} from '../src/paddleCheckout.js';

const TEST_TOKEN = `test_${'a'.repeat(27)}`;
const TRANSACTION_ID = 'txn_01h00000000000000000000000';

test('public Paddle config exposes only a matching client-side token', () => {
  assert.deepEqual(publicPaddleClientConfig({ environment: 'sandbox', token: TEST_TOKEN }), {
    environment: 'sandbox',
    token: TEST_TOKEN
  });
  assert.equal(publicPaddleClientConfig({ environment: 'sandbox', token: `live_${'a'.repeat(27)}` }), null);
  assert.equal(publicPaddleClientConfig({ environment: 'sandbox', token: 'pdl_sdbx_secret' }), null);
});

test('Paddle launcher loads the fixed vendor script and opens only a server transaction', async () => {
  const calls = [];
  const paddle = {
    Environment: { set(value) { calls.push(['environment', value]); } },
    Initialize(value) { calls.push(['initialize', value]); },
    Checkout: { open(value) { calls.push(['open', value]); } }
  };
  const launcher = createPaddleCheckoutLauncher({
    loadPaddle: async (src) => {
      calls.push(['load', src]);
      return paddle;
    }
  });

  await launcher.open({
    transactionId: TRANSACTION_ID,
    config: { environment: 'sandbox', token: TEST_TOKEN },
    locale: 'zh-CN'
  });

  assert.deepEqual(calls[0], ['load', 'https://cdn.paddle.com/paddle/v2/paddle.js']);
  assert.deepEqual(calls[1], ['environment', 'sandbox']);
  assert.deepEqual(calls[2], ['initialize', { token: TEST_TOKEN }]);
  assert.deepEqual(calls[3], ['open', {
    transactionId: TRANSACTION_ID,
    settings: { displayMode: 'overlay', theme: 'dark', locale: 'zh' }
  }]);
});

test('Paddle launcher initializes once and rejects untrusted transaction input', async () => {
  let initializeCount = 0;
  const launcher = createPaddleCheckoutLauncher({
    loadPaddle: async () => ({
      Environment: { set() {} },
      Initialize() { initializeCount += 1; },
      Checkout: { open() {} }
    })
  });
  const input = { transactionId: TRANSACTION_ID, config: { environment: 'sandbox', token: TEST_TOKEN } };
  await launcher.open(input);
  await launcher.open(input);
  assert.equal(initializeCount, 1);
  await assert.rejects(() => launcher.open({ ...input, transactionId: 'https://attacker.example/' }), /invalid_transaction/);
});
