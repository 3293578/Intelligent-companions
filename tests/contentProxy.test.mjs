import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createContentProxyHandler,
  parseContentProxyRequest
} from '../src/contentProxy.js';

test('parseContentProxyRequest accepts a content retrieval plan payload', async () => {
  const request = {
    method: 'POST',
    json: async () => ({
      plan: [
        {
          provider: 'news',
          category: 'world_news',
          sourceType: 'news',
          query: 'calm world news',
          maxResults: 3,
          safeSearch: true
        }
      ]
    })
  };

  const payload = await parseContentProxyRequest(request);

  assert.equal(payload.plan.length, 1);
  assert.equal(payload.plan[0].provider, 'news');
});

test('parseContentProxyRequest rejects non-POST requests', async () => {
  await assert.rejects(
    () => parseContentProxyRequest({ method: 'GET', json: async () => ({}) }),
    /POST/
  );
});

test('content proxy handler returns normalized sources as JSON', async () => {
  const handler = createContentProxyHandler({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            title: 'A calm world update',
            link: 'https://news.example.com/world',
            description: 'A short briefing with context.'
          }
        ]
      })
    })
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      plan: [
        {
          provider: 'news',
          category: 'world_news',
          sourceType: 'news',
          query: 'calm world news',
          maxResults: 3,
          safeSearch: true
        }
      ]
    })
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].category, 'world_news');
});
