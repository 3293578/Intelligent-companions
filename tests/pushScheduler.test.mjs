import test from 'node:test';
import assert from 'node:assert/strict';

import {
  companionsDueForPush,
  createCompanion
} from '../src/companionLogic.js';

function stateWith(companions, messages = []) {
  return {
    user: null,
    selectedCompanionId: companions[0]?.id || '',
    companions,
    messages
  };
}

test('companionsDueForPush returns only companions whose push time has arrived', () => {
  const morning = createCompanion({ id: 'c_morning', name: 'Luna', pushTime: '08:00', maxDaily: 1 });
  const evening = createCompanion({ id: 'c_evening', name: 'Alex', pushTime: '19:30', maxDaily: 1 });
  const state = stateWith([morning, evening]);

  const due = companionsDueForPush(state, { now: '2026-07-06T10:00:00' });

  assert.deepEqual(due.map((companion) => companion.id), ['c_morning']);
});

test('companionsDueForPush skips companions that already reached maxDaily today', () => {
  const luna = createCompanion({ id: 'c_luna', name: 'Luna', pushTime: '08:00', maxDaily: 1 });
  const now = '2026-07-06T10:00:00';
  const state = stateWith([luna], [
    {
      id: 'push_1',
      companionId: luna.id,
      role: 'system_push',
      content: 'Daily Pick already sent.',
      createdAt: '2026-07-06T08:01:00'
    }
  ]);

  assert.deepEqual(companionsDueForPush(state, { now }), []);
});

test('companionsDueForPush allows more pushes when maxDaily is not reached', () => {
  const luna = createCompanion({ id: 'c_luna', name: 'Luna', pushTime: '08:00', maxDaily: 2 });
  const state = stateWith([luna], [
    {
      id: 'push_1',
      companionId: luna.id,
      role: 'system_push',
      content: 'First push today.',
      createdAt: '2026-07-06T08:01:00'
    }
  ]);

  const due = companionsDueForPush(state, { now: '2026-07-06T10:00:00' });
  assert.deepEqual(due.map((companion) => companion.id), ['c_luna']);
});

test('companionsDueForPush counts pushes per day, so yesterday does not block today', () => {
  const luna = createCompanion({ id: 'c_luna', name: 'Luna', pushTime: '08:00', maxDaily: 1 });
  const state = stateWith([luna], [
    {
      id: 'push_yesterday',
      companionId: luna.id,
      role: 'system_push',
      content: 'Push from yesterday.',
      createdAt: '2026-07-05T08:01:00'
    }
  ]);

  const due = companionsDueForPush(state, { now: '2026-07-06T09:00:00' });
  assert.deepEqual(due.map((companion) => companion.id), ['c_luna']);
});
