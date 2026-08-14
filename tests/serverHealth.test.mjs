import test from 'node:test';
import assert from 'node:assert/strict';

import { createHealthPayload, createReadinessPayload, safeProxySummary } from '../src/serverHealth.js';

test('proxy diagnostics never expose credentials, paths, or query strings', () => {
  const summary = safeProxySummary('http://private-user:private-pass@proxy.example:8443/secret?token=hidden');
  assert.deepEqual(summary, { configured: true, endpoint: 'http://proxy.example:8443' });
  assert.doesNotMatch(JSON.stringify(summary), /private|secret|hidden/);
  assert.deepEqual(safeProxySummary(''), { configured: false, endpoint: '' });
});

test('health payload exposes preview readiness without secrets', () => {
  const payload = createHealthPayload({
    startedAt: '2026-07-21T00:00:00.000Z',
    port: 53128,
    processId: 4321
  });

  assert.deepEqual(payload, {
    ok: true,
    product: 'Wyth',
    port: 53128,
    startedAt: '2026-07-21T00:00:00.000Z',
    processId: 4321
  });
  assert.equal('apiKey' in payload, false);
});

test('readiness reports an unavailable model without changing liveness health', () => {
  const readiness = createReadinessPayload({
    configured: false,
    circuit: { state: 'closed' },
    provider: 'deepseek',
    model: 'deepseek-chat',
    startedAt: '2026-07-21T00:00:00.000Z',
    port: 53128,
    processId: 4321
  });

  assert.deepEqual(readiness, {
    status: 503,
    body: {
      ok: false,
      reason: 'model_not_configured',
      product: 'Wyth',
      port: 53128,
      startedAt: '2026-07-21T00:00:00.000Z',
      processId: 4321,
      llm: { configured: false, circuit: 'closed', provider: 'deepseek', model: 'deepseek-chat' }
    }
  });
});

test('readiness reports an open circuit and accepts a configured closed circuit', () => {
  const common = {
    configured: true,
    provider: 'deepseek',
    model: 'deepseek-chat',
    startedAt: '2026-07-21T00:00:00.000Z',
    port: 53128,
    processId: 4321
  };

  assert.equal(createReadinessPayload({ ...common, circuit: { state: 'open' } }).status, 503);
  assert.deepEqual(createReadinessPayload({ ...common, circuit: { state: 'closed' } }), {
    status: 200,
    body: {
      ok: true,
      product: 'Wyth',
      port: 53128,
      startedAt: '2026-07-21T00:00:00.000Z',
      processId: 4321,
      llm: { configured: true, circuit: 'closed', provider: 'deepseek', model: 'deepseek-chat' }
    }
  });
});
