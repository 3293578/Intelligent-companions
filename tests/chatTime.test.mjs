import test from 'node:test';
import assert from 'node:assert/strict';

import { formatChatTimestamp } from '../src/chatTime.js';

test('formats a same-day message in the supplied local timezone', () => {
  assert.equal(
    formatChatTimestamp('2026-07-21T00:05:00.000Z', {
      now: '2026-07-21T08:30:00.000Z',
      locale: 'en-US',
      timeZone: 'Asia/Shanghai'
    }),
    'Today 08:05'
  );
});

test('formats yesterday messages without using server time', () => {
  assert.equal(
    formatChatTimestamp('2026-07-19T16:05:00.000Z', {
      now: '2026-07-21T08:30:00.000Z',
      locale: 'en-US',
      timeZone: 'Asia/Shanghai'
    }),
    'Yesterday 00:05'
  );
});

test('returns an empty label for invalid timestamps', () => {
  assert.equal(formatChatTimestamp('not-a-date'), '');
});
