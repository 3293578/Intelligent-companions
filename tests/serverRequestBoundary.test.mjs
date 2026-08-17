import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { safeRequestFailure } from '../src/requestBoundary.js';

test('request boundary maps malformed and oversized input without leaking error details', () => {
  assert.deepEqual(safeRequestFailure(Object.assign(new Error('secret body'), { status: 413 })), {
    status: 413,
    body: { error: 'request_too_large' }
  });
  assert.deepEqual(safeRequestFailure(new URIError('URI malformed')), {
    status: 400,
    body: { error: 'invalid_request' }
  });
  assert.deepEqual(safeRequestFailure(new Error('api key sk-secret')), {
    status: 500,
    body: { error: 'internal_error', retryable: true }
  });
});

test('Node request handler has one terminal rejection boundary', () => {
  const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(server, /handleRequest\(request, response\)\.catch/);
  assert.match(server, /safeRequestFailure\(error\)/);
});
