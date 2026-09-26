import http from 'node:http';
import { parseModelConfiguration, createByokFetch, createConcurrencyGate } from './src/byok.js';
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
import { createProxyFetch } from './src/nodeProxyFetch.js';
import { createOpenAIResponsesClient } from './src/openaiClient.js';
import { createHealthPayload, safeProxySummary } from './src/serverHealth.js';
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
const memoryStore = createMemoryStore(process.env.MEMORY_STORE_PATH || path.join(root, '.local-data', 'memory.json'));
const startedAt = new Date().toISOString();
const acquire = createConcurrencyGate();
const modelPaths = new Set(['/api/chat', '/api/translate', '/api/language-assist', '/api/model/test']);
const contentProxy = createContentProxyHandler({ fetchImpl: outboundFetch });
const memoryProxy = createMemoryProxyHandler({ memoryStore });

async function handleModelRequest(request, response, userId) {
  if (request.method !== 'POST') { sendJson(response, { error: 'method_not_allowed' }, 405); return; }
  let config;
  try { config = parseModelConfiguration(request.headers['x-wyth-model']); }
  catch { sendJson(response, { error: 'model_configuration_required' }, 400); return; }
  const release = acquire(userId);
  if (!release) { sendJson(response, { error: 'too_many_requests', retryable: true }, 429); return; }
  const controller = new AbortController();
  const disconnected = () => { if (!response.writableEnded) controller.abort(); };
  response.on('close', disconnected);
  const deadline = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]);
  try {
    const proxyRequest = await proxyRequestFromNode(request);
    const pathname = new URL(request.url, appOrigin).pathname;
    const secureFetch = createByokFetch(config);
    const client = createOpenAIResponsesClient({
      ...config, allowEnvironment: false, maxAttempts: 2, requestTimeoutMs: 20000,
      temperature: pathname === '/api/chat' ? 1.1 : pathname === '/api/translate' ? 0.2 : 0.35,
      maxOutputTokens: pathname === '/api/chat' ? 500 : pathname === '/api/translate' ? 400 : 240,
      fetchImpl: (url, options) => secureFetch(url, { ...options, signal: AbortSignal.any([deadline, options.signal || deadline]) })
    });
    if (pathname === '/api/model/test') {
      const output = await client([{ role: 'user', content: 'Reply with OK.' }]);
      if (!String(output || '').trim()) throw new Error('invalid_model_response');
      sendJson(response, { ok: true }); return;
    }
    const llmClientProvider = () => client;
    const handler = pathname === '/api/chat'
      ? createChatProxyHandler({
          llmClientProvider,
          allowLocalFallback: false,
          memoryStore,
          memoryKeyProvider: (_request, companionId) => authConfigured
            ? scopedMemoryId(userId, companionId)
            : companionId,
          onMemoryError() {
            // A memory write failure must not turn a valid model reply into a failed chat.
          }
        })
      : pathname === '/api/translate'
        ? createTranslateProxyHandler({ llmClientProvider, strict: true })
        : createLanguageAssistProxyHandler({ llmClientProvider, strict: true });
    await sendJsonProxyResponse(response, await handler(proxyRequest));
  } catch (error) {
    if (new URL(request.url, appOrigin).pathname === '/api/model/test' && !response.destroyed) {
      const code = [401, 403].includes(error?.status) ? 'model_provider_auth'
        : [400, 404, 405, 422].includes(error?.status) ? 'model_provider_request'
          : error?.status === 429 ? 'model_provider_limit' : 'model_unavailable';
      sendJson(response, { error: code }, 502);
      return;
    }
    if (!response.destroyed) sendJson(response, { error: error?.status === 413 ? 'request_too_large' : 'model_unavailable', retryable: true }, error?.status === 413 ? 413 : 503);
  } finally {
    response.off('close', disconnected);
    release();
  }
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
const publicSourceFiles = new Set([
  'accountStorage.js', 'app.js', 'authBrowser.js', 'authDeadline.js', 'avatarImage.js',
  'byokSession.js', 'chatTime.js', 'chatUiState.js', 'companionLogic.js', 'contentAdapters.js',
  'creationFlowState.js', 'emotionSupport.js', 'interfaceUiState.js', 'notificationPreferences.js',
  'onboardingState.js', 'sceneCatalog.js', 'scenePresentation.js', 'settingsState.js', 'vocabBook.js',
  'wythI18n.js', 'wythUiState.js'
]);

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
  sendJson(response, await proxyResponse.json(), proxyResponse.status);
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
  const publicPath = /^\/(?:index|privacy|terms|refund|support|pricing)\.html$/.test(requestedPath)
    || /^\/(?:styles|legal)\.css$/.test(requestedPath)
    || (requestedPath.startsWith('/src/') && publicSourceFiles.has(requestedPath.slice(5)))
    || /^\/assets\/[a-zA-Z0-9_/. -]+$/.test(requestedPath);
  if (!publicPath || requestedPath.split('/').some((part) => part.startsWith('.'))
      || !filePath.startsWith(root + path.sep) || !mimeTypes[path.extname(filePath)]) {
    response.writeHead(404, responseSecurityHeaders);
    response.end('Not found');
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
  if (isMeteredApiPath(requestUrl.pathname) || modelPaths.has(requestUrl.pathname)) {
    const usage = apiUsageLimiter.consume({
      userId: authenticatedUser?.id || clientIpFromRequest(request, { trustProxy }),
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
  if (modelPaths.has(requestUrl.pathname)) {
    await handleModelRequest(request, response, authenticatedUser?.id || clientIpFromRequest(request, { trustProxy }));
    return;
  }
  if (requestUrl.pathname.startsWith('/api/billing/') || requestUrl.pathname.startsWith('/api/commerce/') || requestUrl.pathname === '/api/model') {
    sendJson(response, { error: 'feature_removed', mode: 'free_byok' }, 410);
    return;
  }
  if (request.url === '/api/health' && request.method === 'GET') {
    sendJson(response, createHealthPayload({ startedAt: startedAt, port, processId: process.pid }));
    return;
  }
  if (request.url === '/api/health/ready' && request.method === 'GET') {
    sendJson(response, { ...createHealthPayload({ startedAt, port, processId: process.pid }), ready: true, mode: 'free_byok', llm: { mode: 'byok', configured: false, userConfigurationRequired: true } });
    return;
  }
  if (requestUrl.pathname === '/api/status') {
    sendJson(response, { app: 'Wyth', startedAt, mode: 'free_byok', llm: { mode: 'byok', configured: false } });
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
  if (requestUrl.pathname === '/api/content') {
    const proxyResponse = await contentProxy(await proxyRequestFromNode(request));
    await sendJsonProxyResponse(response, proxyResponse);
    return;
  }
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(response, { error: 'not_found' }, 404);
    return;
  }
  await serveStatic(request, response);
}

const server = http.createServer({ requestTimeout: 30000, headersTimeout: 15000 }, (request, response) => {
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
  console.log(outboundProxySummary.configured
    ? `External content proxy configured: ${outboundProxySummary.endpoint}`
    : 'External content requests are using direct network access.');
  console.log('Free BYOK mode: no platform model credentials or payments.');
});
