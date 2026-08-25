import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateModelCost, normalizeProviderUsage } from '../src/modelUsage.js';

test('normalizes chat-completion and responses token usage without retaining content', () => {
  assert.deepEqual(normalizeProviderUsage({
    prompt_tokens: 1_000,
    completion_tokens: 200,
    prompt_cache_hit_tokens: 400
  }), { inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 200 });

  assert.deepEqual(normalizeProviderUsage({
    input_tokens: 120,
    output_tokens: 30,
    input_tokens_details: { cached_tokens: 20 }
  }), { inputTokens: 120, cachedInputTokens: 20, outputTokens: 30 });
});

test('estimates DeepSeek V4 Flash usage with configurable per-million rates', () => {
  assert.equal(estimateModelCost({
    inputTokens: 1_000_000,
    cachedInputTokens: 250_000,
    outputTokens: 100_000
  }, {
    inputPerMillionUsd: 0.14,
    cachedInputPerMillionUsd: 0.0028,
    outputPerMillionUsd: 0.28
  }), 0.1337);
});

test('invalid usage values fail closed to non-negative bounded numbers', () => {
  assert.deepEqual(normalizeProviderUsage({ prompt_tokens: -1, completion_tokens: 'bad' }), {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0
  });
});
