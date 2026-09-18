import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { createByokFetch, createConcurrencyGate, isPublicIPv4, parseModelConfiguration } from '../src/byok.js';
import { createByokSession } from '../src/byokSession.js';
import { createOpenAIResponsesClient } from '../src/openaiClient.js';

function header(value) {
  return encodeURIComponent(JSON.stringify(value));
}

test('request model configuration accepts only bounded public HTTPS hostnames', () => {
  const parsed = parseModelConfiguration(header({
    baseUrl: 'https://api.example.com/v1/chat/completions', model: 'example-chat', apiKey: 'secret-key', apiMode: 'chat_completions'
  }));
  assert.equal(parsed.baseUrl, 'https://api.example.com/v1');
  for (const baseUrl of ['http://api.example.com', 'https://127.0.0.1', 'https://user:pass@example.com', 'https://example.com?v=1']) {
    assert.throws(() => parseModelConfiguration(header({ baseUrl, model: 'm', apiKey: 'key' })), /model_configuration_required/);
  }
});

test('public address filter blocks loopback, private, link-local, metadata, and documentation networks', () => {
  for (const ip of ['127.0.0.1', '10.2.3.4', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '203.0.113.2']) {
    assert.equal(isPublicIPv4(ip), false, ip);
  }
  assert.equal(isPublicIPv4('8.8.8.8'), true);
});

test('secure model relay rejects DNS rebinding candidates before opening a socket', async () => {
  let requested = false;
  const config = parseModelConfiguration(header({ baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'key' }));
  const relay = createByokFetch(config, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }],
    request: () => { requested = true; }
  });
  await assert.rejects(() => relay('https://api.example.com/v1/chat/completions', { method: 'POST', body: '{}' }), /invalid_model_destination/);
  assert.equal(requested, false);
});

test('secure model relay pins the validated address and forwards the key only to that origin', async () => {
  let requestOptions;
  const config = parseModelConfiguration(header({ baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'user-secret' }));
  const relay = createByokFetch(config, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request(_url, options, callback) {
      requestOptions = options;
      const req = new EventEmitter();
      req.end = () => {
        const res = new PassThrough();
        res.statusCode = 200;
        callback(res);
        res.end('{"choices":[{"message":{"content":"ok"}}]}');
      };
      return req;
    }
  });
  const response = await relay('https://api.example.com/v1/chat/completions', { method: 'POST', body: '{}' });
  assert.equal(response.status, 200);
  assert.equal(requestOptions.headers.authorization, 'Bearer user-secret');
  await new Promise((resolve, reject) => requestOptions.lookup('api.example.com', {}, (error, address, family) => {
    if (error) reject(error);
    else { assert.equal(address, '93.184.216.34'); assert.equal(family, 4); resolve(); }
  }));
  await assert.rejects(() => relay('https://other.example.com/v1/chat/completions', { method: 'POST', body: '{}' }), /invalid_model_destination/);
});

test('concurrency is isolated per user and releases exactly once', () => {
  const acquire = createConcurrencyGate({ totalLimit: 3, userLimit: 2 });
  const first = acquire('a');
  const second = acquire('a');
  assert.equal(acquire('a'), null);
  assert.equal(typeof acquire('b'), 'function');
  assert.equal(acquire('c'), null);
  first(); first();
  assert.equal(typeof acquire('a'), 'function');
  second();
});

test('browser session keeps the key in memory, clears it, and never uses storage', async () => {
  const calls = [];
  const session = createByokSession({ fetchImpl: async (...args) => { calls.push(args); return new Response('{}'); } });
  session.configure({ baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'key-a' });
  assert.deepEqual(session.summary(), { baseUrl: 'https://api.example.com/v1', model: 'm', apiMode: 'chat_completions', provider: 'custom', configured: true });
  await session.fetch('/api/chat', { method: 'POST' });
  assert.match(decodeURIComponent(calls[0][1].headers['x-wyth-model']), /"apiKey":"key-a"/);
  session.clear();
  await assert.rejects(() => session.fetch('/api/chat'), /model_configuration_required/);
});

test('a failed replacement can restore the last verified in-memory configuration', async () => {
  const calls = [];
  const session = createByokSession({ fetchImpl: async (...args) => { calls.push(args); return new Response('{}'); } });
  session.configure({ baseUrl: 'https://first.example.com/v1', model: 'first', apiKey: 'first-key' });
  const restore = session.configure({ baseUrl: 'https://second.example.com/v1', model: 'second', apiKey: 'second-key' });
  restore();
  await session.fetch('/api/chat', { method: 'POST' });
  const sent = JSON.parse(decodeURIComponent(calls[0][1].headers['x-wyth-model']));
  assert.deepEqual(sent, { baseUrl: 'https://first.example.com/v1', model: 'first', apiKey: 'first-key', apiMode: 'chat_completions' });
});

test('BYOK client cannot silently fall back to the operator environment key', () => {
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'operator-secret';
  try {
    assert.equal(createOpenAIResponsesClient({ allowEnvironment: false, apiKey: '', fetchImpl: async () => new Response('{}') }), null);
  } finally {
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  }
});
