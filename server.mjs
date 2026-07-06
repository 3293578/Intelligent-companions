import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createContentProxyHandler } from './src/contentProxy.js';
import { createChatProxyHandler } from './src/chatProxy.js';
import { createMemoryProxyHandler } from './src/memoryProxy.js';
import { createMemoryStore } from './src/memoryStore.js';
import { createTranslateProxyHandler } from './src/translateProxy.js';
import {
  MODEL_PROVIDER_PRESETS,
  apiKeyForSelection,
  normalizeModelSelection,
  publicModelConfig
} from './src/modelConfig.js';
import { createProxyFetch } from './src/nodeProxyFetch.js';
import { createOpenAIResponsesClient } from './src/openaiClient.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const configuredProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '';
const localProxyFallback = process.env.NO_LOCAL_PROXY_FALLBACK === '1' ? '' : 'http://127.0.0.1:7890';
const outboundProxy = configuredProxy || localProxyFallback;
const outboundFetch = outboundProxy ? createProxyFetch(outboundProxy) : undefined;
// LLM traffic goes direct by default. DeepSeek and most relays are reachable
// without a VPN proxy, and a dead local proxy would silently break chat and
// translation with fallback replies. Set LLM_PROXY (or LLM_USE_PROXY=1 to
// reuse the content proxy) if the model endpoint really needs one.
const llmProxy = process.env.LLM_PROXY || (process.env.LLM_USE_PROXY === '1' ? outboundProxy : '');
const llmFetch = llmProxy ? createProxyFetch(llmProxy) : globalThis.fetch;
let modelSelection = normalizeModelSelection({
  provider: process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY ? 'openai' : 'deepseek'),
  model: process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL,
  baseUrl: process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL,
  apiMode: process.env.LLM_API_MODE
});
const memoryStore = createMemoryStore(process.env.MEMORY_STORE_PATH || path.join(root, '.local-data', 'memory.json'));
const runtimeStatus = {
  startedAt: new Date().toISOString(),
  lastChatSource: null,
  lastChatAt: null,
  lastChatError: null
};
const contentProxy = createContentProxyHandler({
  fetchImpl: outboundFetch
});
function createRuntimeLlmClient(overrides = {}) {
  return createOpenAIResponsesClient({
    apiKey: apiKeyForSelection(modelSelection),
    model: modelSelection.model,
    baseUrl: modelSelection.baseUrl,
    apiMode: modelSelection.apiMode,
    temperature: overrides.temperature,
    maxOutputTokens: overrides.maxOutputTokens,
    fetchImpl: llmFetch
  });
}
const chatProxy = createChatProxyHandler({
  memoryStore,
  // DeepSeek recommends a higher temperature for conversational use; this
  // keeps companion replies varied and human instead of template-flat.
  llmClientProvider: () => createRuntimeLlmClient({ temperature: 1.1, maxOutputTokens: 500 }),
  onMemoryError(error) {
    console.warn(`Memory update failed; continuing chat without backend memory: ${error.message}`);
  },
  onLlmError(error) {
    runtimeStatus.lastChatError = {
      message: error.message,
      at: new Date().toISOString()
    };
    console.warn(`Chat LLM request failed; using local fallback: ${error.message}`);
  }
});
const memoryProxy = createMemoryProxyHandler({
  memoryStore
});
const translateProxy = createTranslateProxyHandler({
  // Translation wants deterministic dictionary-style output, not creativity.
  llmClientProvider: () => createRuntimeLlmClient({ temperature: 0.2, maxOutputTokens: 400 }),
  onLlmError(error) {
    runtimeStatus.lastChatError = {
      message: `Translate: ${error.message}`,
      at: new Date().toISOString()
    };
    console.warn(`Translate LLM request failed; using local fallback: ${error.message}`);
  }
});

function modelOptionsForClient() {
  return Object.fromEntries(
    Object.entries(MODEL_PROVIDER_PRESETS).map(([provider, preset]) => [
      provider,
      {
        label: preset.label,
        defaultModel: preset.defaultModel,
        baseUrl: preset.baseUrl,
        apiMode: preset.apiMode,
        keyEnv: preset.keyEnv
      }
    ])
  );
}

function runtimeLlmStatus() {
  return {
    ...publicModelConfig(modelSelection),
    lastChatSource: runtimeStatus.lastChatSource,
    lastChatAt: runtimeStatus.lastChatAt,
    lastChatError: runtimeStatus.lastChatError
  };
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function proxyRequestFromNode(request) {
  const raw = await readBody(request);
  return {
    method: request.method,
    async json() {
      return raw ? JSON.parse(raw) : {};
    }
  };
}

async function sendJsonProxyResponse(response, proxyResponse) {
  const body = await proxyResponse.text();
  response.writeHead(proxyResponse.status, proxyResponse.headers);
  response.end(body);
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith('/api/status')) {
    sendJson(response, {
      app: 'English Companions',
      startedAt: runtimeStatus.startedAt,
      llm: runtimeLlmStatus(),
      modelOptions: modelOptionsForClient(),
      content: {
        outboundProxy: outboundProxy || '',
        proxyFallback: Boolean(localProxyFallback)
      },
      memory: {
        mode: 'bounded-local-json',
        maxStore: 'per companion profile is capped by memoryStore limits',
        path: process.env.MEMORY_STORE_PATH ? 'custom' : '.local-data/memory.json'
      }
    });
    return;
  }
  if (request.url?.startsWith('/api/model')) {
    if (request.method !== 'POST') {
      sendJson(response, { error: 'Model endpoint expects POST requests.' }, 405);
      return;
    }
    try {
      const body = await (await proxyRequestFromNode(request)).json();
      modelSelection = normalizeModelSelection(body);
      runtimeStatus.lastChatSource = null;
      runtimeStatus.lastChatAt = null;
      runtimeStatus.lastChatError = null;
      sendJson(response, {
        llm: runtimeLlmStatus(),
        modelOptions: modelOptionsForClient()
      });
    } catch (error) {
      sendJson(response, { error: error.message }, 400);
    }
    return;
  }
  if (request.url?.startsWith('/api/memory/')) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const companionId = decodeURIComponent(url.pathname.replace('/api/memory/', ''));
    const proxyResponse = await memoryProxy({ method: request.method }, companionId);
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (request.url?.startsWith('/api/translate')) {
    const proxyResponse = await translateProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (request.url?.startsWith('/api/content')) {
    const proxyResponse = await contentProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (request.url?.startsWith('/api/chat')) {
    const proxyResponse = await chatProxy(await proxyRequestFromNode(request));
    try {
      const body = await proxyResponse.json();
      runtimeStatus.lastChatSource = body.source || null;
      runtimeStatus.lastChatAt = new Date().toISOString();
      if (body.source === 'llm') runtimeStatus.lastChatError = null;
      sendJson(response, body, proxyResponse.status);
      return;
    } catch {
      // Fall back to the generic proxy sender if a future handler returns non-JSON.
    }
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  await serveStatic(request, response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`English Companions running at http://127.0.0.1:${port}`);
  console.log(outboundProxy
    ? `External content proxy configured: ${outboundProxy}`
    : 'External content requests are using direct network access.');
  console.log(llmProxy
    ? `LLM requests use proxy: ${llmProxy}`
    : 'LLM requests use direct network access.');
  console.log(createRuntimeLlmClient()
    ? `Chat LLM configured with model: ${modelSelection.model}`
    : 'Chat LLM is not configured; using local fallback replies.');
});
