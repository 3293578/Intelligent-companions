import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createModelConfigStore } from '../src/modelConfigStore.js';

test('model config store persists DeepSeek selection and key only on the server', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wyth-model-'));
  const filePath = path.join(directory, 'model.json');
  const store = createModelConfigStore(filePath);

  try {
    await store.save({
      selection: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        apiMode: 'chat_completions'
      },
      apiKey: 'sk-local-deepseek-secret'
    });

    const loaded = await store.load();
    assert.equal(loaded.selection.provider, 'deepseek');
    assert.equal(loaded.apiKeys.deepseek, 'sk-local-deepseek-secret');
    assert.match(await readFile(filePath, 'utf8'), /sk-local-deepseek-secret/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('model config store preserves an existing key when a settings save leaves it blank', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wyth-model-'));
  const store = createModelConfigStore(path.join(directory, 'model.json'));

  try {
    await store.save({ selection: { provider: 'deepseek' }, apiKey: 'first-secret' });
    await store.save({ selection: { provider: 'deepseek', model: 'deepseek-chat' }, apiKey: '' });
    assert.equal((await store.load()).apiKeys.deepseek, 'first-secret');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('model config store rejects unsafe or oversized API key values', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wyth-model-'));
  const store = createModelConfigStore(path.join(directory, 'model.json'));

  try {
    await assert.rejects(() => store.save({ selection: { provider: 'deepseek' }, apiKey: 'bad\nkey' }), /invalid/i);
    await assert.rejects(() => store.save({ selection: { provider: 'deepseek' }, apiKey: 'x'.repeat(513) }), /invalid/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
