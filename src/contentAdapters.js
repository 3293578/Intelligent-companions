import {
  buildContentRetrievalPlan,
  normalizeRetrievedContent
} from './companionLogic.js';

const PROVIDER_ENDPOINTS = {
  news: 'https://news.google.com/rss/search',
  youtube: 'https://www.youtube.com/results',
  reddit: 'https://www.reddit.com/search.json',
  web_search: 'https://api.duckduckgo.com/'
};

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

export function providerEndpointForPlanItem(item) {
  const query = item.query || '';

  if (item.provider === 'news') {
    return {
      method: 'GET',
      url: `${PROVIDER_ENDPOINTS.news}?${buildQuery({ q: query, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`
    };
  }

  if (item.provider === 'youtube') {
    return {
      method: 'GET',
      url: `${PROVIDER_ENDPOINTS.youtube}?${buildQuery({ search_query: query, hl: 'en', gl: 'US' })}`
    };
  }

  if (item.provider === 'reddit') {
    return {
      method: 'GET',
      url: `${PROVIDER_ENDPOINTS.reddit}?${buildQuery({ q: query, sort: 'hot', limit: item.maxResults || 3 })}`
    };
  }

  return {
    method: 'GET',
    url: `${PROVIDER_ENDPOINTS.web_search}?${buildQuery({ q: query, format: 'json', no_redirect: 1, no_html: 1 })}`
  };
}

function extractItems(payload) {
  if (payload?.format === 'rss' && typeof payload.xml === 'string') {
    return extractRssItems(payload.xml);
  }
  if (payload?.format === 'youtube_html' && typeof payload.html === 'string') {
    return extractYouTubeItems(payload.html);
  }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.children)) {
    return payload.data.children.map((child) => child.data || child);
  }
  if (Array.isArray(payload?.RelatedTopics)) {
    return payload.RelatedTopics.map((item) => ({
      title: item.Text,
      url: item.FirstURL,
      summary: item.Text
    }));
  }
  return [];
}

function decodeXml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function stripCdata(value = '') {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function tagValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(stripCdata(match[1].trim())) : '';
}

function extractRssItems(xml) {
  return Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map((match) => ({
    title: tagValue(match[1], 'title'),
    url: tagValue(match[1], 'link'),
    summary: tagValue(match[1], 'description'),
    publishedAt: tagValue(match[1], 'pubDate')
  }));
}

function extractYouTubeItems(html) {
  const items = [];
  const seen = new Set();
  const videoMatches = html.matchAll(/"videoId":"([^"]{6,})"[\s\S]{0,600}?"title":\{"runs":\[\{"text":"([^"]+)"/g);

  for (const match of videoMatches) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: decodeJsonText(match[2]),
      url: `https://www.youtube.com/watch?v=${id}`,
      summary: 'A YouTube video result selected from the companion search.'
    });
  }

  if (items.length > 0) return items;

  for (const match of html.matchAll(/\/watch\?v=([A-Za-z0-9_-]{6,})/g)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: 'YouTube video result',
      url: `https://www.youtube.com/watch?v=${id}`,
      summary: 'A YouTube video result selected from the companion search.'
    });
  }

  return items;
}

function decodeJsonText(value = '') {
  try {
    return JSON.parse(`"${value.replaceAll('"', '\\"')}"`);
  } catch {
    return value.replaceAll('\\u0026', '&').replaceAll('\\"', '"');
  }
}

async function parseResponse(response, provider) {
  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType.includes('xml') || contentType.includes('rss')) {
    try {
      return {
        format: 'rss',
        xml: await response.text()
      };
    } catch {
      return {};
    }
  }
  if (provider === 'youtube' && contentType.includes('text/html')) {
    try {
      return {
        format: 'youtube_html',
        html: await response.text()
      };
    } catch {
      return {};
    }
  }
  if (contentType.includes('application/json') || typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  return {};
}

export async function fetchContentForPlan(plan, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return [];

  const sources = [];
  for (const item of plan) {
    try {
      const endpoint = providerEndpointForPlanItem(item);
      const response = await fetchImpl(endpoint.url, { method: endpoint.method });
      if (!response?.ok) continue;
      const payload = await parseResponse(response, item.provider);
      const normalized = extractItems(payload)
        .map((raw) => normalizeRetrievedContent(item.provider, raw, item))
        .filter(Boolean)
        .slice(0, item.maxResults || 3);
      sources.push(...normalized);
    } catch {
      // Provider failures should not break the companion experience.
    }
  }
  return sources;
}

export async function fetchContentViaProxy(plan, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function' || !options.proxyUrl) return [];

  try {
    const response = await fetchImpl(options.proxyUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ plan })
    });
    if (!response?.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.sources) ? payload.sources : [];
  } catch {
    return [];
  }
}

export async function retrieveContentForCompanion(companion, options = {}) {
  const plan = buildContentRetrievalPlan(companion, {
    maxResultsPerQuery: options.maxResultsPerQuery || 3
  });
  if (options.proxyUrl) {
    const proxied = await fetchContentViaProxy(plan, options);
    if (proxied.length > 0) return proxied;
  }
  return fetchContentForPlan(plan, options);
}
