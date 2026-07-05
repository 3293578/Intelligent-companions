import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  fetchContentForPlan,
  providerEndpointForPlanItem,
  retrieveContentForCompanion
} from '../src/contentAdapters.js';

import { createCompanion } from '../src/companionLogic.js';

test('provider endpoint builder creates API-ready URLs from retrieval plan items', () => {
  const endpoint = providerEndpointForPlanItem({
    provider: 'news',
    query: 'calm world news briefing today',
    maxResults: 5,
    safeSearch: true
  });

  assert.equal(endpoint.method, 'GET');
  assert.match(endpoint.url, /^https:\/\/news\.google\.com\/rss\/search\?/);
  assert.match(endpoint.url, /calm\+world\+news\+briefing\+today/);
});

test('browser content adapter does not import Node-only network modules', async () => {
  const source = await readFile(new URL('../src/contentAdapters.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /node:http|node:tls/);
});

test('fetchContentForPlan normalizes provider items and filters unsafe results', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      items: [
        {
          id: 'good-1',
          title: 'A calm world update',
          description: 'A short briefing with context.',
          link: 'https://news.example.com/world'
        },
        {
          id: 'bad-1',
          title: 'Violent prank compilation',
          link: 'https://news.example.com/bad'
        }
      ]
    })
  });

  const sources = await fetchContentForPlan([
    {
      provider: 'news',
      category: 'world_news',
      sourceType: 'news',
      query: 'calm world news briefing today',
      maxResults: 3,
      safeSearch: true
    }
  ], {
    fetchImpl: fakeFetch
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].provider, 'news');
  assert.equal(sources[0].category, 'world_news');
  assert.equal(sources[0].url, 'https://news.example.com/world');
});

test('fetchContentForPlan parses RSS XML provider responses', async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: {
      get: () => 'application/rss+xml'
    },
    text: async () => `<?xml version="1.0"?>
      <rss>
        <channel>
          <item>
            <title>A calm RSS world update</title>
            <link>https://news.example.com/rss-world</link>
            <description>A concise RSS briefing with context.</description>
            <pubDate>Sat, 04 Jul 2026 08:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`
  });

  const sources = await fetchContentForPlan([
    {
      provider: 'news',
      category: 'world_news',
      sourceType: 'news',
      query: 'calm world news briefing today',
      maxResults: 3,
      safeSearch: true
    }
  ], {
    fetchImpl: fakeFetch
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, 'A calm RSS world update');
  assert.equal(sources[0].url, 'https://news.example.com/rss-world');
  assert.equal(sources[0].publishedAt, 'Sat, 04 Jul 2026 08:00:00 GMT');
});

test('fetchContentForPlan extracts YouTube video links from search HTML', async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: {
      get: () => 'text/html; charset=utf-8'
    },
    text: async () => `
      <html>
        <body>
          <a href="/watch?v=abc123def45">ignored</a>
          "videoId":"abc123def45","title":{"runs":[{"text":"Funny English coffee sketch"}]}
        </body>
      </html>`
  });

  const sources = await fetchContentForPlan([
    {
      provider: 'youtube',
      category: 'funny_videos',
      sourceType: 'video',
      query: 'funny short English learning video',
      maxResults: 3,
      safeSearch: true
    }
  ], {
    fetchImpl: fakeFetch
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].provider, 'youtube');
  assert.equal(sources[0].title, 'Funny English coffee sketch');
  assert.equal(sources[0].url, 'https://www.youtube.com/watch?v=abc123def45');
});

test('fetchContentForPlan tolerates provider failures and returns remaining sources', async () => {
  const fakeFetch = async (url) => {
    if (url.includes('news.google.com')) {
      throw new Error('network down');
    }
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            title: 'A playful English skit',
            url: 'https://video.example.com/skit',
            summary: 'Short daily English comedy.'
          }
        ]
      })
    };
  };

  const sources = await fetchContentForPlan([
    {
      provider: 'news',
      category: 'world_news',
      sourceType: 'news',
      query: 'world news',
      maxResults: 3,
      safeSearch: true
    },
    {
      provider: 'youtube',
      category: 'funny_videos',
      sourceType: 'video',
      query: 'funny English video',
      maxResults: 3,
      safeSearch: true
    }
  ], {
    fetchImpl: fakeFetch
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].provider, 'youtube');
});

test('retrieveContentForCompanion builds a plan and returns normalized external sources', async () => {
  const companion = createCompanion({
    name: 'Luna',
    pushCategories: ['funny_videos'],
    contentSources: {
      enabledProviders: ['youtube']
    }
  });
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      items: [
        {
          title: 'A funny English short',
          url: 'https://video.example.com/funny',
          summary: 'A light video for practice.'
        }
      ]
    })
  });

  const sources = await retrieveContentForCompanion(companion, { fetchImpl: fakeFetch });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].category, 'funny_videos');
  assert.equal(sources[0].sourceType, 'video');
});

test('retrieveContentForCompanion can use a proxy endpoint before direct providers', async () => {
  const companion = createCompanion({
    name: 'Alex',
    pushCategories: ['world_news'],
    contentSources: {
      enabledProviders: ['news']
    }
  });
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        sources: [
          {
            id: 'proxy-news',
            provider: 'news',
            category: 'world_news',
            sourceType: 'news',
            title: 'Proxy world update',
            summary: 'Returned by local content proxy.',
            url: 'https://news.example.com/proxy',
            safety: 'safe'
          }
        ]
      })
    };
  };

  const sources = await retrieveContentForCompanion(companion, {
    fetchImpl: fakeFetch,
    proxyUrl: '/api/content'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/content');
  assert.equal(calls[0].options.method, 'POST');
  assert.match(calls[0].options.body, /world_news/);
  assert.equal(sources[0].id, 'proxy-news');
});
