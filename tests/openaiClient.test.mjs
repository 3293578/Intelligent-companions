import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compactMessagesForRetry,
  createOpenAIResponsesClient,
  extractResponseText,
  resolveLlmConfig
} from '../src/openaiClient.js';

test('extractResponseText reads output_text first', () => {
  assert.equal(extractResponseText({ output_text: 'Hello from Luna.' }), 'Hello from Luna.');
});

test('extractResponseText reads nested response output content', () => {
  const payload = {
    output: [
      {
        content: [
          {
            type: 'output_text',
            text: 'Nested hello.'
          }
        ]
      }
    ]
  };

  assert.equal(extractResponseText(payload), 'Nested hello.');
});

test('resolveLlmConfig prefers DeepSeek environment variables without exposing the API key', () => {
  const config = resolveLlmConfig({
    DEEPSEEK_API_KEY: 'secret-key',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    OPENAI_API_KEY: 'openai-key'
  });

  assert.equal(config.configured, true);
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(config.baseUrl, 'https://api.deepseek.com');
  assert.equal(config.apiMode, 'chat_completions');
  assert.equal(Object.hasOwn(config, 'apiKey'), false);
});

test('LLM client posts DeepSeek chat completion messages and returns text by default', async () => {
  const calls = [];
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'I am here with you. Tell me one detail from today.'
              }
            }
          ]
        })
      };
    }
  });

  const text = await client([
    { role: 'system', content: 'You are Luna.' },
    { role: 'user', content: 'I feel tired.' }
  ]);

  assert.equal(text, 'I am here with you. Tell me one detail from today.');
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-key');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, 'deepseek-v4-flash');
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].content, 'I feel tired.');
});

test('LLM client can post responses requests to a custom compatible base URL', async () => {
  const calls = [];
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    model: 'gpt-5.5',
    baseUrl: 'https://relay.example.com/v1',
    apiMode: 'responses',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          output_text: 'Relay model reply.'
        })
      };
    }
  });

  const text = await client([{ role: 'user', content: 'Hi' }]);

  assert.equal(text, 'Relay model reply.');
  assert.equal(calls[0].url, 'https://relay.example.com/v1/responses');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-key');
});

test('OpenAI Responses client normalizes custom base URL with a trailing slash', async () => {
  const calls = [];
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    baseUrl: 'https://relay.example.com/v1/',
    apiMode: 'responses',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ output_text: 'ok' })
      };
    }
  });

  await client([{ role: 'user', content: 'Hi' }]);

  assert.equal(calls[0], 'https://relay.example.com/v1/responses');
});

test('OpenAI Responses client falls back to chat completions for compatible relays', async () => {
  const calls = [];
  const client = createOpenAIResponsesClient({
    apiKey: 'relay-key',
    model: 'gpt-5.5',
    baseUrl: 'https://relay.example.com/v1',
    apiMode: 'responses',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/responses')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'not found' } })
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Chat completions relay reply.'
              }
            }
          ]
        })
      };
    }
  });

  const text = await client([
    { role: 'system', content: 'You are Luna.' },
    { role: 'user', content: 'Hi' }
  ]);

  assert.equal(text, 'Chat completions relay reply.');
  assert.equal(calls[0].url, 'https://relay.example.com/v1/responses');
  assert.equal(calls[1].url, 'https://relay.example.com/v1/chat/completions');
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].content, 'Hi');
});

test('OpenAI Responses client returns empty text on API failure', async () => {
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid key'
    })
  });

  await assert.rejects(
    client([{ role: 'user', content: 'Hi' }]),
    /LLM request failed with 401 at https:\/\/api\.deepseek\.com\/chat\/completions/
  );
});

test('LLM client preserves a safe provider error reason for diagnostics', async () => {
  const client = createOpenAIResponsesClient({
    apiKey: 'secret-that-must-not-leak',
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'invalid_request_error',
          message: 'Requested model is not available.'
        }
      })
    })
  });

  await assert.rejects(
    client([{ role: 'user', content: 'Hi' }]),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'invalid_request_error');
      assert.match(error.message, /Requested model is not available/);
      assert.doesNotMatch(error.message, /secret-that-must-not-leak/);
      return true;
    }
  );
});

test('LLM client retries a context-length failure with bounded recent messages', async () => {
  const calls = [];
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    maxInputCharacters: 120,
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      if (calls.length === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { code: 'context_length_exceeded', message: 'Context length exceeded.' } })
        };
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Recovered reply.' } }] })
      };
    }
  });

  const text = await client([
    { role: 'system', content: `instructions ${'x'.repeat(90)}` },
    { role: 'user', content: `old ${'a'.repeat(80)}` },
    { role: 'assistant', content: `older ${'b'.repeat(80)}` },
    { role: 'user', content: 'latest message' }
  ]);

  assert.equal(text, 'Recovered reply.');
  assert.equal(calls.length, 2);
  assert.ok(JSON.stringify(calls[1].messages).length < JSON.stringify(calls[0].messages).length);
  assert.equal(calls[1].messages.at(-1).content, 'latest message');
});

test('LLM client retries one transient provider failure', async () => {
  let attempts = 0;
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    retryDelayMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { code: 'rate_limit', message: 'Try again.' } })
        };
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Recovered after retry.' } }] })
      };
    }
  });

  assert.equal(await client([{ role: 'user', content: 'Hi' }]), 'Recovered after retry.');
  assert.equal(attempts, 2);
});

test('LLM client retries transient fetch failures until the network recovers', async () => {
  let attempts = 0;
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    maxAttempts: 3,
    retryDelayMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        const cause = new Error('socket disconnected before secure TLS connection');
        cause.code = 'ECONNRESET';
        throw new TypeError('fetch failed', { cause });
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Recovered network reply.' } }] })
      };
    }
  });

  assert.equal(await client([{ role: 'user', content: 'Hi' }]), 'Recovered network reply.');
  assert.equal(attempts, 3);
});

test('LLM network errors preserve a safe cause code after retries are exhausted', async () => {
  const client = createOpenAIResponsesClient({
    apiKey: 'test-key',
    maxAttempts: 2,
    retryDelayMs: 0,
    fetchImpl: async () => {
      const cause = new Error('getaddrinfo EAI_AGAIN api.deepseek.com');
      cause.code = 'EAI_AGAIN';
      throw new TypeError('fetch failed', { cause });
    }
  });

  await assert.rejects(
    client([{ role: 'user', content: 'Hi' }]),
    (error) => {
      assert.equal(error.code, 'EAI_AGAIN');
      assert.equal(error.attempts, 2);
      assert.match(error.message, /network request failed/i);
      return true;
    }
  );
});

test('message compaction keeps the system instruction and newest turn', () => {
  const compacted = compactMessagesForRetry([
    { role: 'system', content: `system ${'s'.repeat(100)}` },
    { role: 'user', content: `old ${'o'.repeat(100)}` },
    { role: 'assistant', content: `middle ${'m'.repeat(100)}` },
    { role: 'user', content: 'newest' }
  ], 80);

  assert.equal(compacted[0].role, 'system');
  assert.equal(compacted.at(-1).content, 'newest');
  assert.ok(compacted.reduce((total, message) => total + message.content.length, 0) <= 80);
});
