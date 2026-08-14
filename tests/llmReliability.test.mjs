import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCircuitBreaker,
  createInstrumentedLlmClient,
  createSafeLlmDiagnostic
} from '../src/llmReliability.js';

test('circuit breaker blocks provider calls after repeated failures and recovers after its cooldown', () => {
  let now = 1_000;
  const circuit = createCircuitBreaker({
    failureThreshold: 2,
    resetMs: 5_000,
    now: () => now
  });

  assert.equal(circuit.beforeRequest().allowed, true);
  circuit.recordFailure();
  circuit.recordFailure();
  assert.deepEqual(circuit.beforeRequest(), { allowed: false, state: 'open' });

  now += 5_000;
  assert.deepEqual(circuit.beforeRequest(), { allowed: true, state: 'half_open' });
  circuit.recordSuccess();
  assert.deepEqual(circuit.snapshot(), {
    state: 'closed',
    consecutiveFailures: 0,
    retryAt: null
  });
});

test('safe LLM diagnostics categorize failures without exposing keys or message content', () => {
  const diagnostic = createSafeLlmDiagnostic({
    requestId: 'req_123',
    error: Object.assign(new Error('fetch failed: sk-secret-token'), {
      code: 'ECONNRESET',
      attempts: 3
    }),
    latencyMs: 420,
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: 'Never reveal this system prompt.' },
      { role: 'user', content: 'A private user sentence.' }
    ]
  });

  assert.deepEqual(diagnostic, {
    requestId: 'req_123',
    category: 'network',
    attempts: 3,
    latencyMs: 420,
    model: 'deepseek-v4-flash',
    context: { messageCount: 2, characterCount: 56 }
  });
  assert.equal(JSON.stringify(diagnostic).includes('secret'), false);
  assert.equal(JSON.stringify(diagnostic).includes('private'), false);
});

test('safe LLM diagnostics identify provider HTTP and timeout failures', () => {
  const providerError = Object.assign(new Error('bad request'), { status: 429 });
  const timeoutError = Object.assign(new Error('aborted'), { name: 'AbortError' });

  assert.equal(createSafeLlmDiagnostic({ error: providerError }).category, 'provider_4xx');
  assert.equal(createSafeLlmDiagnostic({ error: timeoutError }).category, 'timeout');
});

test('instrumented client opens only for transient provider failures and attaches a safe request ID', async () => {
  const circuit = createCircuitBreaker({ failureThreshold: 1, now: () => 10 });
  const diagnostics = [];
  const client = createInstrumentedLlmClient({
    client: async () => { throw Object.assign(new Error('provider unavailable'), { status: 503, attempts: 2 }); },
    circuit,
    createRequestId: () => 'req_test',
    now: () => 123,
    model: 'deepseek-v4-flash',
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });

  await assert.rejects(
    () => client([{ role: 'user', content: 'Private chat text.' }]),
    (error) => error.requestId === 'req_test'
  );
  assert.equal(circuit.snapshot().state, 'open');
  assert.deepEqual(diagnostics, [{
    requestId: 'req_test',
    category: 'provider_5xx',
    attempts: 2,
    latencyMs: 0,
    model: 'deepseek-v4-flash',
    context: { messageCount: 1, characterCount: 18 }
  }]);
  assert.equal(JSON.stringify(diagnostics).includes('Private'), false);
});

test('instrumented client does not trip the circuit for a provider validation error', async () => {
  const circuit = createCircuitBreaker({ failureThreshold: 1 });
  const client = createInstrumentedLlmClient({
    client: async () => { throw Object.assign(new Error('invalid model'), { status: 400 }); },
    circuit
  });

  await assert.rejects(() => client([]));
  assert.equal(circuit.snapshot().state, 'closed');
});
