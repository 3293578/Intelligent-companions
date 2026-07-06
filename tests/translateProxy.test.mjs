import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTranslateMessages,
  createLocalTranslationFallback,
  createTranslateProxyHandler,
  detectTranslationTarget,
  parseTranslateProxyRequest,
  parseTranslationPayload
} from '../src/translateProxy.js';

test('parseTranslateProxyRequest requires POST and non-empty text', async () => {
  await assert.rejects(
    parseTranslateProxyRequest({ method: 'GET', json: async () => ({}) }),
    /POST/
  );
  await assert.rejects(
    parseTranslateProxyRequest({ method: 'POST', json: async () => ({ text: '   ' }) }),
    /requires text/
  );
});

test('parseTranslateProxyRequest trims and bounds text and context', async () => {
  const longText = 'a'.repeat(500);
  const parsed = await parseTranslateProxyRequest({
    method: 'POST',
    json: async () => ({
      text: `  ${longText}  `,
      context: 'b'.repeat(1000)
    })
  });

  assert.equal(parsed.text.length, 280);
  assert.equal(parsed.context.length, 600);
});

test('detectTranslationTarget picks Chinese for English text and English for CJK text', () => {
  assert.equal(detectTranslationTarget('serendipity'), 'Chinese');
  assert.equal(detectTranslationTarget('缘分'), 'English');
  assert.equal(detectTranslationTarget('hello', 'Japanese'), 'Japanese');
});

test('buildTranslateMessages includes selected text, context, and target language', () => {
  const messages = buildTranslateMessages({
    text: 'wind down',
    context: 'A mellow playlist for winding down.',
    targetLanguage: ''
  });

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /into Chinese/);
  assert.match(messages[1].content, /wind down/);
  assert.match(messages[1].content, /mellow playlist/);
});

test('parseTranslationPayload accepts plain JSON and fenced JSON', () => {
  const plain = parseTranslationPayload('{"translation":"放松","pronunciation":"","explanation":"表示放松下来","examples":["I need to wind down. 我需要放松一下。"]}');
  assert.equal(plain.translation, '放松');
  assert.equal(plain.examples.length, 1);

  const fenced = parseTranslationPayload('```json\n{"translation":"缘分","pronunciation":"yuánfèn","explanation":"fateful coincidence","examples":[]}\n```');
  assert.equal(fenced.translation, '缘分');
  assert.equal(fenced.pronunciation, 'yuánfèn');
});

test('parseTranslationPayload rejects malformed or empty payloads', () => {
  assert.equal(parseTranslationPayload(''), null);
  assert.equal(parseTranslationPayload('not json at all'), null);
  assert.equal(parseTranslationPayload('{"translation":""}'), null);
});

test('translate proxy handler returns LLM translation when the client succeeds', async () => {
  const calls = [];
  const handler = createTranslateProxyHandler({
    llmClient: async (messages) => {
      calls.push(messages);
      return '{"translation":"心情低落","pronunciation":"","explanation":"感到沮丧","examples":["I feel down today. 我今天心情低落。"]}';
    }
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      text: 'feel down',
      context: 'I feel down today.'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, 'llm');
  assert.equal(body.targetLanguage, 'Chinese');
  assert.equal(body.result.translation, '心情低落');
  assert.match(calls[0][1].content, /feel down/);
});

test('translate proxy handler falls back locally when no client is configured', async () => {
  const handler = createTranslateProxyHandler({});

  const response = await handler({
    method: 'POST',
    json: async () => ({ text: 'serendipity' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, 'local_fallback');
  assert.equal(body.result.translation, '');
  assert.match(body.result.explanation, /API key/);
});

test('translate proxy handler falls back when the LLM client throws', async () => {
  const errors = [];
  const handler = createTranslateProxyHandler({
    llmClient: async () => {
      throw new Error('model offline');
    },
    onLlmError: (error) => errors.push(error.message)
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({ text: 'serendipity' })
  });
  const body = await response.json();

  assert.equal(body.source, 'local_fallback');
  assert.deepEqual(errors, ['model offline']);
});

test('translate proxy handler resolves a fresh client from the provider', async () => {
  const handler = createTranslateProxyHandler({
    llmClientProvider: () => async () => '{"translation":"你好","explanation":"","examples":[]}'
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({ text: 'hello' })
  });
  const body = await response.json();

  assert.equal(body.source, 'llm');
  assert.equal(body.result.translation, '你好');
});

test('createLocalTranslationFallback mentions the selected text', () => {
  const fallback = createLocalTranslationFallback('cozy');
  assert.match(fallback.explanation, /cozy/);
});
