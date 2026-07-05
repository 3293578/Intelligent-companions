import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
