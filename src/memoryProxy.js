import { formatMemoryForPrompt } from './memoryStore.js';

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

function countEntries(profile) {
  return Object.values(profile.memories || {})
    .reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0);
}

export function createMemoryProxyHandler(options = {}) {
  return async function handleMemoryProxy(request, companionId) {
    if (!['GET', 'DELETE'].includes(request.method)) {
      return jsonResponse({ error: 'Memory endpoint expects GET or DELETE requests.' }, 405);
    }
    if (!companionId) {
      return jsonResponse({ error: 'Memory endpoint requires a companion id.' }, 400);
    }
    if (!options.memoryStore) {
      return jsonResponse({ error: 'Memory store is not configured.' }, 503);
    }

    const profile = request.method === 'DELETE'
      ? await options.memoryStore.clearProfile(companionId)
      : await options.memoryStore.getProfile(companionId);
    return jsonResponse({
      companionId,
      entryCount: countEntries(profile),
      approxBytes: profile.approxBytes || 0,
      promptSummary: formatMemoryForPrompt(profile),
      updatedAt: profile.updatedAt || ''
    });
  };
}
