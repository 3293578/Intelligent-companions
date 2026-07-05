import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  MEMORY_LIMITS,
  createMemoryStore,
  extractMemoryEntries,
  formatMemoryForPrompt,
  mergeMemoryProfile
} from '../src/memoryStore.js';

test('extracts compact categorized memory without keeping full chat prose', () => {
  const entries = extractMemoryEntries({
    content: 'My cat Mochi made me laugh after work, and I prefer gentle advice when I feel stressed.'
  }, '2026-07-05T10:00:00.000Z');

  assert.ok(entries.some((entry) => entry.type === 'fact' && /Mochi/.test(entry.text)));
  assert.ok(entries.some((entry) => entry.type === 'preference' && /gentle advice/.test(entry.text)));
  assert.ok(entries.some((entry) => entry.type === 'emotional_pattern' && /stressed/.test(entry.text)));
  assert.ok(entries.every((entry) => entry.text.length <= MEMORY_LIMITS.entryTextChars));
  assert.ok(entries.every((entry) => !entry.text.includes('made me laugh after work, and I prefer')));
});

test('mergeMemoryProfile deduplicates entries and keeps each memory bucket bounded', () => {
  const now = '2026-07-05T10:00:00.000Z';
  const manyFacts = Array.from({ length: MEMORY_LIMITS.perType + 4 }, (_, index) => ({
    type: 'fact',
    text: `User shared important fact number ${index}`,
    createdAt: `2026-07-05T10:${String(index).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-07-05T10:${String(index).padStart(2, '0')}:00.000Z`,
    strength: 1
  }));
  const profile = mergeMemoryProfile({ companionId: 'luna', memories: { fact: [] } }, [
    ...manyFacts,
    { type: 'fact', text: 'User shared important fact number 8', createdAt: now, updatedAt: '2026-07-05T11:00:00.000Z', strength: 1 }
  ], now);

  assert.equal(profile.memories.fact.length, MEMORY_LIMITS.perType);
  assert.equal(profile.memories.fact.at(-1).text, 'User shared important fact number 8');
  assert.equal(profile.memories.fact.at(-1).strength, 2);
  assert.ok(profile.approxBytes < MEMORY_LIMITS.maxProfileBytes);
});

test('memory store persists bounded companion memory to local backend storage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'english-companions-memory-'));
  try {
    const store = createMemoryStore(path.join(dir, 'memory.json'));

    await store.remember('companion_luna', {
      content: 'My cat Mochi is shy. I like funny short videos and I feel anxious before interviews.'
    }, { now: '2026-07-05T09:00:00.000Z' });
    await store.remember('companion_luna', {
      content: 'My cat Mochi is shy. Please remember I prefer warm encouragement.'
    }, { now: '2026-07-05T09:05:00.000Z' });

    const saved = await store.getProfile('companion_luna');
    const restored = createMemoryStore(path.join(dir, 'memory.json'));
    const promptMemory = formatMemoryForPrompt(await restored.getProfile('companion_luna'));

    assert.equal(saved.companionId, 'companion_luna');
    assert.ok(saved.approxBytes < MEMORY_LIMITS.maxProfileBytes);
    assert.match(promptMemory, /Mochi/);
    assert.match(promptMemory, /warm encouragement|funny short videos/);
    assert.ok(promptMemory.length < MEMORY_LIMITS.promptChars);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('memory store can clear one companion profile without touching others', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'english-companions-memory-'));
  try {
    const store = createMemoryStore(path.join(dir, 'memory.json'));

    await store.remember('companion_luna', {
      content: 'My cat Mochi is shy and I prefer warm encouragement.'
    }, { now: '2026-07-05T09:00:00.000Z' });
    await store.remember('companion_alex', {
      content: 'I like direct tech explanations.'
    }, { now: '2026-07-05T09:01:00.000Z' });

    const cleared = await store.clearProfile('companion_luna');
    const luna = await store.getProfile('companion_luna');
    const alex = await store.getProfile('companion_alex');

    assert.equal(cleared.companionId, 'companion_luna');
    assert.equal(formatMemoryForPrompt(luna), '');
    assert.match(formatMemoryForPrompt(alex), /direct tech explanations/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
