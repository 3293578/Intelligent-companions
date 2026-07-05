import { fetchContentForPlan } from './contentAdapters.js';

export async function parseContentProxyRequest(request) {
  if (request.method !== 'POST') {
    throw new Error('Content proxy expects POST requests.');
  }
  const body = await request.json();
  if (!Array.isArray(body?.plan)) {
    throw new Error('Content proxy request requires a plan array.');
  }
  return {
    plan: body.plan
  };
}

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

export function createContentProxyHandler(options = {}) {
  return async function handleContentProxy(request) {
    try {
      const { plan } = await parseContentProxyRequest(request);
      const sources = await fetchContentForPlan(plan, {
        fetchImpl: options.fetchImpl,
        maxResultsPerQuery: options.maxResultsPerQuery
      });
      return jsonResponse({ sources });
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }
  };
}
