const DEFAULT_OPENAI_MODEL = 'deepseek-v4-flash';
const DEFAULT_OPENAI_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_API_MODE = 'chat_completions';

function buildResponsesUrl(baseUrl) {
  return `${String(baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '')}/responses`;
}

function buildChatCompletionsUrl(baseUrl) {
  return `${String(baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '')}/chat/completions`;
}

export function extractResponseText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const parts = [];
    for (const item of payload.output) {
      for (const content of item.content || []) {
        if (typeof content.text === 'string') parts.push(content.text);
      }
    }
    return parts.join('\n').trim();
  }

  return '';
}

function extractChatCompletionText(payload = {}) {
  const content = payload.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

function normalizeMessages(messages = []) {
  return messages
    .filter((message) => message?.role && message?.content)
    .map((message) => ({
      role: message.role,
      content: String(message.content)
    }));
}

function truncateContent(content, limit) {
  if (limit <= 0) return '';
  const text = String(content || '');
  return text.length <= limit ? text : text.slice(0, limit);
}

export function compactMessagesForRetry(messages = [], maxCharacters = 12000) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length) return [];
  const budget = Math.max(1, Number(maxCharacters) || 12000);
  const newest = normalized.at(-1);
  const system = normalized[0]?.role === 'system' ? normalized[0] : null;
  const newestContent = truncateContent(newest.content, budget);
  const remainingAfterNewest = Math.max(0, budget - newestContent.length);
  const systemContent = system && system !== newest
    ? truncateContent(system.content, remainingAfterNewest)
    : '';
  let remaining = Math.max(0, remainingAfterNewest - systemContent.length);
  const middle = [];
  const startIndex = system ? 1 : 0;
  for (let index = normalized.length - 2; index >= startIndex && remaining > 0; index -= 1) {
    const message = normalized[index];
    const content = truncateContent(message.content, remaining);
    if (content) middle.unshift({ ...message, content });
    remaining -= content.length;
  }
  return [
    ...(systemContent ? [{ ...system, content: systemContent }] : []),
    ...middle,
    { ...newest, content: newestContent }
  ];
}

async function readProviderError(response, apiKey) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    try {
      payload = { error: { message: await response.text() } };
    } catch {
      payload = null;
    }
  }
  const providerError = payload?.error || payload || {};
  const code = String(providerError.code || providerError.type || '').slice(0, 80);
  const rawMessage = String(providerError.message || '').replace(/[\r\n\0]+/g, ' ').trim();
  const safeMessage = (apiKey ? rawMessage.replaceAll(apiKey, '[redacted]') : rawMessage).slice(0, 300);
  return { code, message: safeMessage };
}

async function createRequestError(response, url, apiKey) {
  const details = await readProviderError(response, apiKey);
  const suffix = details.message ? `: ${details.message}` : '';
  const error = new Error(`LLM request failed with ${response?.status || 'unknown status'} at ${url}${suffix}`);
  error.status = Number(response?.status || 0);
  error.code = details.code;
  return error;
}

function isRecoverableBadRequest(error) {
  // DeepSeek uses HTTP 400 for context/token validation failures, sometimes
  // without a stable machine-readable code. Retry once with bounded context.
  return error?.status === 400;
}

function isTransientError(error) {
  return [408, 409, 429, 500, 502, 503, 504].includes(error?.status)
    || error?.name === 'AbortError'
    || error?.name === 'TimeoutError'
    || (error instanceof TypeError && error.message === 'fetch failed');
}

function normalizeNetworkError(error, attempts) {
  if (!(error instanceof TypeError) || error.message !== 'fetch failed') return error;
  const causeCode = String(error.cause?.code || 'NETWORK_ERROR').slice(0, 80);
  const causeMessage = String(error.cause?.message || error.message).replace(/[\r\n\0]+/g, ' ').slice(0, 240);
  const normalized = new Error(`LLM network request failed after ${attempts} attempts: ${causeMessage}`);
  normalized.code = causeCode;
  normalized.attempts = attempts;
  normalized.cause = error;
  return normalized;
}

export function resolveLlmConfig(env = process.env, options = {}) {
  const apiKey = options.apiKey || env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || '';
  const model = options.model || env.DEEPSEEK_MODEL || env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const baseUrl = options.baseUrl || env.DEEPSEEK_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL;
  const apiMode = options.apiMode || env.LLM_API_MODE || DEFAULT_API_MODE;

  return {
    configured: Boolean(apiKey),
    model,
    baseUrl,
    apiMode
  };
}

export function createOpenAIResponsesClient(options = {}) {
  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
  const { model, baseUrl, apiMode } = resolveLlmConfig(process.env, options);
  const responsesUrl = buildResponsesUrl(baseUrl);
  const chatCompletionsUrl = buildChatCompletionsUrl(baseUrl);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxInputCharacters = Number(options.maxInputCharacters || 12000);
  const retryDelayMs = Number(options.retryDelayMs ?? 120);
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
  const requestTimeoutMs = Math.max(1000, Number(options.requestTimeoutMs || 20000));

  if (!apiKey || typeof fetchImpl !== 'function') return null;

  async function postChat(messages) {
    const chatResponse = await fetchImpl(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: normalizeMessages(messages),
        temperature: Number(options.temperature ?? 0.8),
        max_tokens: Number(options.maxOutputTokens ?? 450)
      }),
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    if (chatResponse?.ok) return extractChatCompletionText(await chatResponse.json());
    throw await createRequestError(chatResponse, chatCompletionsUrl, apiKey);
  }

  async function postChatWithRecovery(messages) {
    let requestMessages = messages;
    let contextWasCompacted = false;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await postChat(requestMessages);
      } catch (error) {
        lastError = error;
        if (isRecoverableBadRequest(error) && !contextWasCompacted) {
          requestMessages = compactMessagesForRetry(messages, maxInputCharacters);
          contextWasCompacted = true;
        } else if (!isTransientError(error)) {
          throw error;
        }
        if (attempt < maxAttempts && retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        }
      }
    }
    throw normalizeNetworkError(lastError, maxAttempts);
  }

  return async function openAIResponsesClient(messages) {
    if (apiMode === 'chat_completions') {
      return postChatWithRecovery(messages);
    }

    const response = await fetchImpl(responsesUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: normalizeMessages(messages),
        temperature: Number(options.temperature ?? 0.8),
        max_output_tokens: Number(options.maxOutputTokens ?? 450)
      }),
      signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (response?.ok) {
      return extractResponseText(await response.json());
    }

    if ([400, 404, 405].includes(response?.status)) {
      return postChatWithRecovery(messages);
    }

    throw await createRequestError(response, responsesUrl, apiKey);
  };
}

export {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  buildChatCompletionsUrl,
  buildResponsesUrl
};
