import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createContentProxyHandler } from './src/contentProxy.js';
import { createChatProxyHandler } from './src/chatProxy.js';
import { createMemoryProxyHandler } from './src/memoryProxy.js';
import { createMemoryStore } from './src/memoryStore.js';
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
  lastChatAt: null
};
const contentProxy = createContentProxyHandler({
  fetchImpl: outboundFetch
});
function createRuntimeLlmClient() {
  return createOpenAIResponsesClient({
    apiKey: apiKeyForSelection(modelSelection),
    model: modelSelection.model,
    baseUrl: modelSelection.baseUrl,
    apiMode: modelSelection.apiMode,
    fetchImpl: outboundFetch || globalThis.fetch
  });
}
const chatProxy = createChatProxyHandler({
  memoryStore,
  llmClientProvider: createRuntimeLlmClient,
  onMemoryError(error) {
    console.warn(`Memory update failed; continuing chat without backend memory: ${error.message}`);
  },
  onLlmError(error) {
    console.warn(`Chat LLM request failed; using local fallback: ${error.message}`);
  }
});
const memoryProxy = createMemoryProxyHandler({
  memoryStore
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
    lastChatAt: runtimeStatus.lastChatAt
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
  console.log(createRuntimeLlmClient()
    ? `Chat LLM configured with model: ${modelSelection.model}`
    : 'Chat LLM is not configured; using local fallback replies.');
});
