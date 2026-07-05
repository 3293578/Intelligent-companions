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

  if (!apiKey || typeof fetchImpl !== 'function') return null;

  return async function openAIResponsesClient(messages) {
    if (apiMode === 'chat_completions') {
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
        })
      });

      if (chatResponse?.ok) {
        return extractChatCompletionText(await chatResponse.json());
      }

      throw new Error(`LLM request failed with ${chatResponse?.status || 'unknown status'} at ${chatCompletionsUrl}`);
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
      })
    });

    if (response?.ok) {
      return extractResponseText(await response.json());
    }

    if ([400, 404, 405].includes(response?.status)) {
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
        })
      });

      if (chatResponse?.ok) {
        return extractChatCompletionText(await chatResponse.json());
      }

      throw new Error(`LLM request failed with ${chatResponse?.status || 'unknown status'} at ${chatCompletionsUrl}`);
    }

    throw new Error(`LLM request failed with ${response?.status || 'unknown status'} at ${responsesUrl}`);
  };
}

export {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  buildChatCompletionsUrl,
  buildResponsesUrl
};
