import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLanguageAssistMessages,
  createLanguageAssistProxyHandler,
  parseLanguageAssistPayload,
  parseLanguageAssistRequest
} from '../src/languageAssistProxy.js';

test('language assist requires a POST request with selected text', async () => {
  await assert.rejects(parseLanguageAssistRequest({ method: 'GET', json: async () => ({}) }), /POST/);
  await assert.rejects(parseLanguageAssistRequest({ method: 'POST', json: async () => ({ text: '' }) }), /requires text/);
});

test('language assist prompt asks for one natural alternative without correcting unsolicited chat', () => {
  const messages = buildLanguageAssistMessages({ text: 'I very like it', context: 'I very like it.', language: 'English' });
  assert.match(messages[0].content, /explicitly requested/);
  assert.match(messages[0].content, /naturalAlternative/);
  assert.match(messages[1].content, /I very like it/);
});

test('language assist parses compact JSON and falls back safely', () => {
  assert.deepEqual(parseLanguageAssistPayload('{"naturalAlternative":"I really like it.","note":"More natural word order."}'), {
    naturalAlternative: 'I really like it.',
    note: 'More natural word order.'
  });
  assert.equal(parseLanguageAssistPayload('bad'), null);
});

test('language assist handler returns an LLM result', async () => {
  const handler = createLanguageAssistProxyHandler({
    llmClient: async () => '{"naturalAlternative":"I really like it.","note":"Natural emphasis."}'
  });
  const response = await handler({ method: 'POST', json: async () => ({ text: 'I very like it' }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.naturalAlternative, 'I really like it.');
});
