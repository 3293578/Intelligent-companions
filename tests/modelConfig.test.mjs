import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_PROVIDER_PRESETS,
  normalizeModelSelection,
  publicModelConfig
} from '../src/modelConfig.js';

test('normalizes model selection without companion or memory data', () => {
  const selection = normalizeModelSelection({
    provider: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/',
    apiMode: 'chat_completions',
    companionId: 'companion_luna',
    memorySummary: 'Do not carry this into model config.'
  });

  assert.deepEqual(selection, {
    provider: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    apiMode: 'chat_completions'
  });
});

test('falls back to DeepSeek defaults for unknown or empty model settings', () => {
  const selection = normalizeModelSelection({
    provider: 'unknown',
    model: '',
    baseUrl: '',
    apiMode: 'bad_mode'
  });

  assert.equal(selection.provider, 'deepseek');
  assert.equal(selection.model, MODEL_PROVIDER_PRESETS.deepseek.defaultModel);
  assert.equal(selection.baseUrl, MODEL_PROVIDER_PRESETS.deepseek.baseUrl);
  assert.equal(selection.apiMode, 'chat_completions');
});

test('public model config reports key availability without exposing secrets', () => {
  const config = publicModelConfig(
    normalizeModelSelection({ provider: 'openai_compatible', model: 'custom-chat' }),
    {
      LLM_API_KEY: 'secret-compatible-key',
      DEEPSEEK_API_KEY: 'deepseek-secret'
    }
  );

  assert.equal(config.configured, true);
  assert.equal(config.provider, 'openai_compatible');
  assert.equal(config.keyEnv, 'LLM_API_KEY');
  assert.equal(Object.hasOwn(config, 'apiKey'), false);
  assert.equal(JSON.stringify(config).includes('secret'), false);
});
