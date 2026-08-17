import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

import { createContentProxyHandler } from './src/contentProxy.js';
import { createChatProxyHandler } from './src/chatProxy.js';
import { createMemoryProxyHandler } from './src/memoryProxy.js';
import { createMemoryStore } from './src/memoryStore.js';
import { createTranslateProxyHandler } from './src/translateProxy.js';
import { createLanguageAssistProxyHandler } from './src/languageAssistProxy.js';
import {
  MODEL_PROVIDER_PRESETS,
  apiKeyForSelection,
  normalizeModelSelection,
  publicModelConfig
} from './src/modelConfig.js';
import { createModelConfigStore } from './src/modelConfigStore.js';
import { createNetworkFallbackFetch, createProxyFetch } from './src/nodeProxyFetch.js';
import { createOpenAIResponsesClient } from './src/openaiClient.js';
import { createCircuitBreaker, createInstrumentedLlmClient } from './src/llmReliability.js';
import { createHealthPayload, createReadinessPayload, safeProxySummary } from './src/serverHealth.js';
import { createSupabaseAuthClient, createVerifiedSessionCache, isAuthUnavailableError, resolveAuthenticatedUser } from './src/authServer.js';
import { createAuthRouteHandler } from './src/authRoutes.js';
import { isPublicApiPath, scopedMemoryId } from './src/apiAccess.js';
import { clientIpFromRequest, createApiUsageLimiter, isMeteredApiPath } from './src/apiRateLimit.js';
import { assertProductionEnvironment, resolveServerHost } from './src/runtimeConfig.js';
import { createSecurityHeaders, staticCacheControl } from './src/httpSecurity.js';
import { safeRequestFailure } from './src/requestBoundary.js';

const root = path.dirname(fileURLToPath(import.meta.url));
try {
  loadEnvFile(path.join(root, '.env.local'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const portFlagIndex = process.argv.indexOf('--port');
const portFromFlag = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : '';
const port = Number(portFromFlag || process.env.PORT || 5173);
assertProductionEnvironment(process.env);
const host = resolveServerHost(process.env);
const responseSecurityHeaders = createSecurityHeaders({ production: process.env.NODE_ENV === 'production' });
const trustProxy = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1';
const apiUsageLimiter = createApiUsageLimiter({
  userMinuteLimit: process.env.LLM_RATE_LIMIT_PER_MINUTE,
  ipMinuteLimit: process.env.LLM_IP_RATE_LIMIT_PER_MINUTE,
  userDailyLimit: process.env.LLM_DAILY_REQUEST_LIMIT
});
const configuredProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '';
const localProxyFallback = process.env.NO_LOCAL_PROXY_FALLBACK === '1' ? '' : 'http://127.0.0.1:7890';
const outboundProxy = configuredProxy || localProxyFallback;
const outboundFetch = outboundProxy ? createProxyFetch(outboundProxy) : undefined;
const appOrigin = String(process.env.APP_ORIGIN || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const authConfigured = Boolean(supabaseUrl && supabasePublishableKey);
const authSessionCache = createVerifiedSessionCache();
const authClient = authConfigured
  ? createSupabaseAuthClient({ supabaseUrl, publishableKey: supabasePublishableKey, fetchImpl: outboundFetch })
  : null;
const authRoutes = createAuthRouteHandler({
  configured: authConfigured,
  authClient,
  appOrigin,
  secureCookies: process.env.NODE_ENV === 'production' || appOrigin.startsWith('https://'),
  recoverySecret: process.env.AUTH_RECOVERY_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'wyth-local-development-recovery'),
  sessionCache: authSessionCache
});
if (authConfigured && process.env.NODE_ENV === 'production' && !process.env.AUTH_RECOVERY_SECRET) {
  throw new Error('AUTH_RECOVERY_SECRET is required in production.');
}
// LLM traffic goes direct by default. If the operating environment rejects a
// direct network connection, local development can retry through the already
// trusted outbound proxy. Provider HTTP errors are never retried this way.
const llmProxy = process.env.LLM_PROXY || (process.env.LLM_USE_PROXY === '1' ? outboundProxy : '');
const llmFetch = llmProxy
  ? createProxyFetch(llmProxy)
  : createNetworkFallbackFetch({
      primaryFetch: globalThis.fetch,
      fallbackFetch: outboundFetch
    });
const environmentModelSelection = normalizeModelSelection({
  provider: process.env.LLM_PROVIDER || 'deepseek',
  model: process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL,
  baseUrl: process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL,
  apiMode: process.env.LLM_API_MODE
});
const memoryStore = createMemoryStore(process.env.MEMORY_STORE_PATH || path.join(root, '.local-data', 'memory.json'));
const runtimeStatus = {
  startedAt: new Date().toISOString(),
  lastChatSource: null,
  lastChatAt: null,
  lastLlmDiagnostic: null
};
const chatCircuit = createCircuitBreaker();
const contentProxy = createContentProxyHandler({
  fetchImpl: outboundFetch
});
function createRuntimeLlmClient(overrides = {}) {
  const client = createOpenAIResponsesClient({
    apiKey: apiKeyForSelection(modelSelection, process.env, storedModelConfig.apiKeys),
    model: modelSelection.model,
    baseUrl: modelSelection.baseUrl,
    apiMode: modelSelection.apiMode,
    temperature: overrides.temperature,
    maxOutputTokens: overrides.maxOutputTokens,
    fetchImpl: llmFetch
  });
  if (!client || overrides.operation !== 'chat') return client;
  return createInstrumentedLlmClient({
    client,
    circuit: chatCircuit,
    model: modelSelection.model,
    onDiagnostic(diagnostic) {
      runtimeStatus.lastLlmDiagnostic = diagnostic;
      console.warn(JSON.stringify({ event: 'llm_failure', ...diagnostic }));
    }
  });
}
const chatProxy = createChatProxyHandler({
  memoryStore,
  memoryKeyProvider: (request, companionId) => authConfigured
    ? scopedMemoryId(request.authenticatedUser?.id, companionId)
    : companionId,
  allowLocalFallback: process.env.ALLOW_LOCAL_FALLBACK === '1',
  // DeepSeek recommends a higher temperature for conversational use; this
  // keeps companion replies varied and human instead of template-flat.
  llmClientProvider: () => createRuntimeLlmClient({
    operation: 'chat', temperature: 1.1, maxOutputTokens: 500
  }),
  onMemoryError(error) {
    console.warn(`Memory update failed; continuing chat without backend memory: ${error.message}`);
  },
  onLlmError(error) {
    if (!runtimeStatus.lastLlmDiagnostic?.requestId && error.requestId) {
      runtimeStatus.lastLlmDiagnostic = { requestId: error.requestId, category: 'unknown' };
    }
  }
});
const memoryProxy = createMemoryProxyHandler({
  memoryStore
});
const translateProxy = createTranslateProxyHandler({
  // Translation wants deterministic dictionary-style output, not creativity.
  llmClientProvider: () => createRuntimeLlmClient({ temperature: 0.2, maxOutputTokens: 400 }),
  onLlmError(error) {
    console.warn(`Translate LLM request failed: ${String(error.code || error.name || 'unknown')}`);
  }
});
const modelConfigStore = createModelConfigStore(process.env.MODEL_CONFIG_PATH || path.join(root, '.local-data', 'model.json'));
let storedModelConfig = await modelConfigStore.load();
let modelSelection = storedModelConfig.selection || environmentModelSelection;
const languageAssistProxy = createLanguageAssistProxyHandler({
  llmClientProvider: () => createRuntimeLlmClient({ temperature: 0.35, maxOutputTokens: 240 }),
  onLlmError(error) {
    console.warn(`Language assist LLM request failed: ${String(error.code || error.name || 'unknown')}`);
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
    ...publicModelConfig(modelSelection, process.env, storedModelConfig.apiKeys),
    lastChatSource: runtimeStatus.lastChatSource,
    lastChatAt: runtimeStatus.lastChatAt,
    lastLlmDiagnostic: runtimeStatus.lastLlmDiagnostic,
    circuit: chatCircuit.snapshot().state
  };
}

function runtimeLlmConfigured() {
  return Boolean(apiKeyForSelection(modelSelection, process.env, storedModelConfig.apiKeys));
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32 * 1024) {
      const error = new Error('request_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
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
  const proxyHeaders = Object.fromEntries(proxyResponse.headers.entries());
  response.writeHead(proxyResponse.status, {
    ...proxyHeaders,
    ...responseSecurityHeaders,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    ...responseSecurityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

function writeAuthResponse(response, result) {
  const headers = { ...result.headers, ...responseSecurityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (result.cookies?.length) headers['set-cookie'] = result.cookies;
  if (result.status === 303) {
    delete headers['content-type'];
    response.writeHead(result.status, headers);
    response.end();
    return;
  }
  response.writeHead(result.status, headers);
  response.end(JSON.stringify(result.body));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403, responseSecurityHeaders);
    response.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      ...responseSecurityHeaders,
      'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': staticCacheControl(requestedPath)
    });
    response.end(data);
  } catch {
    response.writeHead(404, responseSecurityHeaders);
    response.end('Not found');
  }
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, appOrigin);
  if (request.url?.startsWith('/api/auth/')) {
    let body = {};
    try {
      if (request.method !== 'GET') body = await (await proxyRequestFromNode(request)).json();
    } catch (error) {
      sendJson(response, { error: error?.status === 413 ? 'request_too_large' : 'invalid_request' }, error?.status || 400);
      return;
    }
    const result = await authRoutes({
      method: request.method,
      url: new URL(request.url, appOrigin).toString(),
      headers: request.headers,
      body,
      ip: request.socket.remoteAddress || ''
    });
    writeAuthResponse(response, result);
    return;
  }
  let authenticatedUser = null;
  if (authConfigured && requestUrl.pathname.startsWith('/api/') && !isPublicApiPath(requestUrl.pathname)) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== appOrigin) {
      sendJson(response, { error: 'invalid_origin' }, 403);
      return;
    }
    try {
      const authenticated = await resolveAuthenticatedUser(request.headers.cookie, authClient, {
        secure: process.env.NODE_ENV === 'production' || appOrigin.startsWith('https://'),
        sessionCache: authSessionCache
      });
      authenticatedUser = authenticated.user;
      if (!authenticatedUser?.email_confirmed_at && !authenticatedUser?.confirmed_at) {
        sendJson(response, { error: 'email_not_verified' }, 403);
        return;
      }
      if (authenticated.cookies.length) response.setHeader('set-cookie', authenticated.cookies);
    } catch (error) {
      if (isAuthUnavailableError(error)) {
        sendJson(response, { error: 'auth_unavailable', retryable: true }, 503);
      } else {
        sendJson(response, { error: 'authentication_required' }, 401);
      }
      return;
    }
  }
  if (authConfigured && authenticatedUser && isMeteredApiPath(requestUrl.pathname)) {
    const usage = apiUsageLimiter.consume({
      userId: authenticatedUser.id,
      ip: clientIpFromRequest(request, { trustProxy })
    });
    if (!usage.allowed) {
      sendJson(response, {
        error: usage.reason === 'daily_limit' ? 'daily_request_limit' : 'too_many_requests',
        retryable: usage.reason !== 'daily_limit',
        retryAfterMs: usage.retryAfterMs
      }, 429);
      return;
    }
  }
  if (request.url === '/api/health' && request.method === 'GET') {
    sendJson(response, createHealthPayload({ startedAt: runtimeStatus.startedAt, port, processId: process.pid }));
    return;
  }
  if (request.url === '/api/health/ready' && request.method === 'GET') {
    const readiness = createReadinessPayload({
      configured: runtimeLlmConfigured(),
      circuit: chatCircuit.snapshot(),
      provider: modelSelection.provider,
      model: modelSelection.model,
      startedAt: runtimeStatus.startedAt,
      port,
      processId: process.pid
    });
    sendJson(response, readiness.body, readiness.status);
    return;
  }
  if (request.url?.startsWith('/api/status')) {
    sendJson(response, {
      app: 'English Companions',
      startedAt: runtimeStatus.startedAt,
      llm: runtimeLlmStatus(),
      modelOptions: modelOptionsForClient(),
      content: {
        outboundProxy: safeProxySummary(outboundProxy),
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
    if (process.env.ALLOW_MODEL_CONFIG_ENDPOINT !== '1') {
      sendJson(response, { error: 'not_found' }, 404);
      return;
    }
    if (request.method !== 'POST') {
      sendJson(response, { error: 'Model endpoint expects POST requests.' }, 405);
      return;
    }
    try {
      const body = await (await proxyRequestFromNode(request)).json();
      storedModelConfig = await modelConfigStore.save({ selection: body, apiKey: body.apiKey });
      modelSelection = storedModelConfig.selection;
      runtimeStatus.lastChatSource = null;
      runtimeStatus.lastChatAt = null;
      runtimeStatus.lastLlmDiagnostic = null;
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
    const memoryId = authConfigured ? scopedMemoryId(authenticatedUser.id, companionId) : companionId;
    const proxyResponse = await memoryProxy({ method: request.method }, memoryId, companionId);
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname === '/api/translate') {
    const proxyResponse = await translateProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname === '/api/language-assist') {
    const proxyResponse = await languageAssistProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname === '/api/content') {
    const proxyResponse = await contentProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname === '/api/chat') {
    const proxyRequest = await proxyRequestFromNode(request);
    proxyRequest.authenticatedUser = authenticatedUser;
    const proxyResponse = await chatProxy(proxyRequest);
    try {
      const body = await proxyResponse.json();
      runtimeStatus.lastChatSource = body.source || null;
      runtimeStatus.lastChatAt = new Date().toISOString();
      if (body.source === 'llm') runtimeStatus.lastLlmDiagnostic = null;
      sendJson(response, body, proxyResponse.status);
      return;
    } catch {
      // Fall back to the generic proxy sender if a future handler returns non-JSON.
    }
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(response, { error: 'not_found' }, 404);
    return;
  }
  await serveStatic(request, response);
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const failure = safeRequestFailure(error);
    console.error(JSON.stringify({ event: 'request_failure', status: failure.status }));
    if (response.headersSent || response.writableEnded) {
      response.destroy();
      return;
    }
    sendJson(response, failure.body, failure.status);
  });
});

server.listen(port, host, () => {
  console.log(`Wyth listening on ${host}:${port}; public origin ${appOrigin}`);
  const outboundProxySummary = safeProxySummary(outboundProxy);
  const llmProxySummary = safeProxySummary(llmProxy);
  console.log(outboundProxySummary.configured
    ? `External content proxy configured: ${outboundProxySummary.endpoint}`
    : 'External content requests are using direct network access.');
  console.log(llmProxySummary.configured
    ? `LLM requests use proxy: ${llmProxySummary.endpoint}`
    : 'LLM requests use direct network access.');
  console.log(createRuntimeLlmClient()
    ? `Chat LLM configured with model: ${modelSelection.model}`
    : 'Chat LLM is not configured; using local fallback replies.');
});
