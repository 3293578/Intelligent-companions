import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addVocabEntry,
  createVocabEntry,
  deserializeVocabBook,
  removeVocabEntry,
  serializeVocabBook
} from '../src/vocabBook.js';

test('createVocabEntry normalizes fields and rejects empty text', () => {
  assert.equal(createVocabEntry({ text: '   ' }), null);

  const entry = createVocabEntry({
    text: '  wind down  ',
    translation: '放松',
    examples: ['I need to wind down. 我需要放松。', '', 'extra one', 'dropped']
  });

  assert.equal(entry.text, 'wind down');
  assert.equal(entry.translation, '放松');
  assert.equal(entry.examples.length, 2);
  assert.ok(entry.id.startsWith('vocab_'));
  assert.ok(entry.savedAt);
});

test('addVocabEntry puts newest first and dedupes case-insensitively', () => {
  let book = addVocabEntry([], { text: 'Serendipity', translation: '机缘巧合' });
  book = addVocabEntry(book, { text: 'cozy', translation: '温馨' });
  book = addVocabEntry(book, { text: 'serendipity', translation: '更新后的释义' });

  assert.equal(book.length, 2);
  assert.equal(book[0].text, 'serendipity');
  assert.equal(book[0].translation, '更新后的释义');
  assert.equal(book[1].text, 'cozy');
});

test('addVocabEntry keeps the book bounded', () => {
  let book = [];
  for (let index = 0; index < 210; index += 1) {
    book = addVocabEntry(book, { text: `word-${index}` });
  }
  assert.equal(book.length, 200);
  assert.equal(book[0].text, 'word-209');
});

test('removeVocabEntry removes a single entry by id', () => {
  const book = addVocabEntry([], { text: 'cozy' });
  const removed = removeVocabEntry(book, book[0].id);
  assert.equal(removed.length, 0);
  assert.equal(removeVocabEntry(book, 'missing').length, 1);
});

test('vocab book survives a serialize/deserialize round trip and bad input', () => {
  const book = addVocabEntry([], { text: 'cozy', translation: '温馨' });
  const restored = deserializeVocabBook(serializeVocabBook(book));

  assert.equal(restored.length, 1);
  assert.equal(restored[0].text, 'cozy');
  assert.deepEqual(deserializeVocabBook('not json'), []);
  assert.deepEqual(deserializeVocabBook('{"a":1}'), []);
});
