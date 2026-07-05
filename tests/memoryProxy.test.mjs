import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryProxyHandler } from '../src/memoryProxy.js';

test('memory proxy returns bounded summary metadata for one companion', async () => {
  const handler = createMemoryProxyHandler({
    memoryStore: {
      async getProfile(companionId) {
        return {
          companionId,
          updatedAt: '2026-07-05T10:00:00.000Z',
          approxBytes: 512,
          memories: {
            fact: [{ text: 'User fact: User has a cat named Mochi.' }],
            preference: [{ text: 'User preference: User prefers warm encouragement.' }],
            emotional_pattern: [],
            recent_event: []
          }
        };
      }
    }
  });

  const response = await handler({ method: 'GET' }, 'companion_luna');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.companionId, 'companion_luna');
  assert.equal(body.entryCount, 2);
  assert.equal(body.approxBytes, 512);
  assert.match(body.promptSummary, /Mochi/);
});

test('memory proxy rejects unsupported methods', async () => {
  const handler = createMemoryProxyHandler({ memoryStore: {} });

  const response = await handler({ method: 'POST' }, 'companion_luna');
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.match(body.error, /GET/);
});

test('memory proxy clears one companion profile with DELETE', async () => {
  const clearedIds = [];
  const handler = createMemoryProxyHandler({
    memoryStore: {
      async clearProfile(companionId) {
        clearedIds.push(companionId);
        return {
          companionId,
          updatedAt: '2026-07-05T11:00:00.000Z',
          approxBytes: 120,
          memories: {
            fact: [],
            preference: [],
            emotional_pattern: [],
            recent_event: []
          }
        };
      }
    }
  });

  const response = await handler({ method: 'DELETE' }, 'companion_luna');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(clearedIds, ['companion_luna']);
  assert.equal(body.companionId, 'companion_luna');
  assert.equal(body.entryCount, 0);
  assert.equal(body.promptSummary, '');
});
