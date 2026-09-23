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

test('late rollbacks cannot resurrect a key after sign out or override newer settings', async () => {
  const session = createByokSession({ fetchImpl: async () => new Response('{}') });
  session.configure({ baseUrl: 'https://one.example.com', model: 'one', apiKey: 'old-key' });
  const firstCheckpoint = session.checkpoint();
  const rollback = session.configure({ baseUrl: 'https://two.example.com', model: 'two', apiKey: 'new-key' });
  assert.equal(firstCheckpoint(), false);
  const pendingCheckpoint = session.checkpoint();
  session.clear();
  assert.equal(pendingCheckpoint(), false);
  rollback();
  assert.equal(session.summary().configured, false);
  await assert.rejects(session.fetch('/api/chat'), /model_configuration_required/);
  session.configure({ baseUrl: 'https://three.example.com', model: 'three', apiKey: 'third-key' });
  rollback();
  assert.equal(session.summary().model, 'three');
});

test('changing destination requires a new key and logout aborts in-flight requests', async () => {
  let signal;
  const session = createByokSession({ fetchImpl: async (_url, options) => { signal = options.signal; return new Response('{}'); } });
  session.configure({ baseUrl: 'https://one.example.com', model: 'one', apiKey: 'old-key' });
  assert.throws(() => session.configure({ baseUrl: 'https://two.example.com', model: 'two', apiKey: '' }));
  await session.fetch('/api/chat', { method: 'POST' });
  assert.equal(signal.aborted, false);
  session.clear();
  assert.equal(signal.aborted, true);
});

function fakeRelay(status, contents, mode = '') {
  const config = parseModelConfiguration(header({ baseUrl: 'https://api.example.com', model: 'm', apiKey: 'key' }));
  return createByokFetch(config, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request(_url, _options, callback) {
      const req = new EventEmitter();
      req.end = () => {
        const res = new PassThrough();
        res.statusCode = status;
        callback(res);
        if (mode === 'aborted') res.emit('aborted');
        else res.end(contents);
      };
      return req;
    }
  });
}

for (const status of [204, 205, 304, 302]) {
  test(`provider HTTP ${status} rejects safely without crashing the server`, async () => {
    const relay = fakeRelay(status, '');
    await assert.rejects(relay('https://api.example.com/chat/completions', { method: 'POST' }), /invalid_model_response|model_redirect_not_allowed/);
  });
}

test('oversized and interrupted provider responses fail explicitly', async () => {
  const oversized = fakeRelay(200, Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(oversized('https://api.example.com/chat/completions', { method: 'POST' }), /model_response_too_large/);
  const aborted = fakeRelay(200, '', 'aborted');
  await assert.rejects(aborted('https://api.example.com/chat/completions', { method: 'POST' }), /model_response_aborted/);
});

test('DNS cancellation does not open a socket and recovers for the next request', async () => {
  const config = parseModelConfiguration(header({ baseUrl: 'https://api.example.com', model: 'm', apiKey: 'key' }));
  const controller = new AbortController();
  let opened = false;
  const relay = createByokFetch(config, { resolve: () => new Promise(() => {}), request() { opened = true; } });
  const pending = relay('https://api.example.com/chat/completions', { method: 'POST', signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /model_timeout/);
  assert.equal(opened, false);
  const healthy = fakeRelay(200, '{"ok":true}');
  assert.deepEqual(await (await healthy('https://api.example.com/chat/completions', { method: 'POST' })).json(), { ok: true });
});

test('100 parallel user sessions never share keys and all concurrency slots recover', async () => {
  const acquire = createConcurrencyGate({ totalLimit: 100, userLimit: 2 });
  await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const release = acquire(String(index));
    assert.equal(typeof release, 'function');
    try {
      const session = createByokSession({ fetchImpl: async (_url, options) => {
        await new Promise((resolve) => setTimeout(resolve, index % 4));
        assert.equal(JSON.parse(decodeURIComponent(options.headers['x-wyth-model'])).apiKey, `key-${index}`);
        return new Response('{}');
      } });
      session.configure({ baseUrl: 'https://api.example.com', model: `m-${index}`, apiKey: `key-${index}` });
      await session.fetch('/api/chat', { method: 'POST' });
    } finally { release(); }
  }));
  const releases = Array.from({ length: 100 }, (_, i) => acquire(String(i)));
  assert.equal(releases.every((release) => typeof release === 'function'), true);
  releases.forEach((release) => release());
});
