import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProxyFetch,
  fetchTextThroughHttpProxy
} from '../src/nodeProxyFetch.js';

test('fetchTextThroughHttpProxy sends a CONNECT request and reads HTTPS response text', async () => {
  const writes = [];
  const fakeClient = {
    request: async (proxy, targetUrl, requestText) => {
      writes.push({ proxy, targetUrl, requestText });
      return 'HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\n\r\nhello';
    }
  };

  const result = await fetchTextThroughHttpProxy('https://example.com/path?q=1', {
    proxyUrl: 'http://127.0.0.1:7890',
    proxyClient: fakeClient
  });

  assert.equal(result.status, 200);
  assert.equal(result.body, 'hello');
  assert.equal(writes[0].proxy.hostname, '127.0.0.1');
  assert.match(writes[0].requestText, /GET \/path\?q=1 HTTP\/1\.1/);
});

test('createProxyFetch exposes a fetch-like response object', async () => {
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async () => 'HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{"ok":true}'
    }
  });

  const response = await fetchImpl('https://example.com/data.json');

  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { ok: true });
});

test('createProxyFetch follows HTTPS redirects before returning the response', async () => {
  const requestedPaths = [];
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async (_proxy, targetUrl) => {
        requestedPaths.push(`${targetUrl.hostname}${targetUrl.pathname}`);
        if (targetUrl.pathname === '/old') {
          return 'HTTP/1.1 302 Found\r\nlocation: https://example.com/new\r\n\r\n';
        }
        return 'HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\n\r\nredirected';
      }
    }
  });

  const response = await fetchImpl('https://example.com/old');

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'redirected');
  assert.deepEqual(requestedPaths, ['example.com/old', 'example.com/new']);
});

test('createProxyFetch decodes chunked transfer bodies', async () => {
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async () => [
        'HTTP/1.1 200 OK',
        'content-type: application/json',
        'transfer-encoding: chunked',
        '',
        '7',
        '{"ok":t',
        '4',
        'rue}',
        '0',
        '',
        ''
      ].join('\r\n')
    }
  });

  const response = await fetchImpl('https://example.com/chunked.json');

  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(await response.text(), '{"ok":true}');
});

test('createProxyFetch respects content-length when extra bytes follow the JSON body', async () => {
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async () => [
        'HTTP/1.1 200 OK',
        'content-type: application/json',
        'content-length: 11',
        '',
        '{"ok":true}',
        'HTTP/1.1 200 Connection established',
        ''
      ].join('\r\n')
    }
  });

  const response = await fetchImpl('https://api.deepseek.com/chat/completions');

  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(await response.text(), '{"ok":true}');
});

test('createProxyFetch parses the first JSON value when proxy response has trailing bytes', async () => {
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async () => [
        'HTTP/1.1 200 OK',
        'content-type: application/json',
        '',
        '{"choices":[{"message":{"content":"hello"}}]}',
        'HTTP/1.1 200 Connection established',
        ''
      ].join('\r\n')
    }
  });

  const response = await fetchImpl('https://api.deepseek.com/chat/completions');

  assert.deepEqual(await response.json(), {
    choices: [
      {
        message: {
          content: 'hello'
        }
      }
    ]
  });
});

test('createProxyFetch sends POST requests with headers and body through the proxy', async () => {
  const writes = [];
  const fetchImpl = createProxyFetch('http://127.0.0.1:7890', {
    proxyClient: {
      request: async (_proxy, _targetUrl, requestText) => {
        writes.push(requestText);
        return 'HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{"ok":true}';
      }
    }
  });

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-key',
      'content-type': 'application/json'
    },
    body: '{"model":"gpt-4.1-mini"}'
  });

  assert.equal(response.status, 200);
  assert.match(writes[0], /^POST \/v1\/responses HTTP\/1\.1/);
  assert.match(writes[0], /authorization: Bearer test-key/i);
  assert.match(writes[0], /content-type: application\/json/i);
  assert.match(writes[0], /content-length: 24/i);
  assert.match(writes[0], /\r\n\r\n\{"model":"gpt-4\.1-mini"\}$/);
});
