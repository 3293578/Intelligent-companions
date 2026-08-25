import test from 'node:test';
import assert from 'node:assert/strict';

import { withAuthDeadline } from '../src/authDeadline.js';

test('auth deadline rejects even when the underlying request ignores cancellation', async () => {
  let triggerTimeout;
  let aborted = false;
  const pending = withAuthDeadline(
    () => new Promise(() => {}),
    {
      timeoutMs: 9_000,
      setTimer(callback, delay) {
        assert.equal(delay, 9_000);
        triggerTimeout = callback;
        return 17;
      },
      clearTimer() {},
      onTimeout() { aborted = true; }
    }
  );

  triggerTimeout();
  await assert.rejects(pending, (error) => error.code === 'auth_unavailable');
  assert.equal(aborted, true);
});

test('auth deadline returns a completed request and clears its timer', async () => {
  const cleared = [];
  const result = await withAuthDeadline(
    async () => ({ ok: true }),
    {
      timeoutMs: 9_000,
      setTimer() { return 23; },
      clearTimer(timerId) { cleared.push(timerId); }
    }
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(cleared, [23]);
});
