import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNotificationPreferences,
  loadNotificationPreferences,
  normalizeNotificationPreferences,
  saveNotificationPreferences
} from '../src/notificationPreferences.js';

test('notification preferences normalize booleans, permission, and valid quiet-hour times', () => {
  assert.deepEqual(normalizeNotificationPreferences({
    enabled: 1,
    permission: 'denied',
    quietHours: { enabled: 0, start: '21:45', end: '07:15' }
  }), {
    enabled: false,
    permission: 'denied',
    quietHours: { enabled: false, start: '21:45', end: '07:15' }
  });
  assert.deepEqual(normalizeNotificationPreferences({
    enabled: true,
    permission: 'invented',
    quietHours: { enabled: true, start: '99:00', end: '' }
  }), createNotificationPreferences());
});

test('notifications stay disabled until permission is granted', () => {
  assert.deepEqual(createNotificationPreferences(), {
    enabled: false,
    permission: 'default',
    quietHours: { enabled: true, start: '22:30', end: '07:00' }
  });
  assert.equal(normalizeNotificationPreferences({ enabled: true, permission: 'default' }).enabled, false);
  assert.equal(normalizeNotificationPreferences({ enabled: true, permission: 'denied' }).enabled, false);
  assert.equal(normalizeNotificationPreferences({ enabled: true, permission: 'unsupported' }).enabled, false);
  assert.equal(normalizeNotificationPreferences({ enabled: true, permission: 'granted' }).enabled, true);
});

test('invalid quiet hour fields fall back independently without resetting other preferences', () => {
  assert.deepEqual(normalizeNotificationPreferences({
    enabled: true,
    permission: 'granted',
    quietHours: { enabled: false, start: '99:00', end: '06:15' }
  }), {
    enabled: true,
    permission: 'granted',
    quietHours: { enabled: false, start: '22:30', end: '06:15' }
  });
});

test('notification preferences round-trip through an injected storage boundary', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const next = {
    enabled: false,
    permission: 'granted',
    quietHours: { enabled: false, start: '20:00', end: '06:30' }
  };
  assert.equal(saveNotificationPreferences(storage, 'notifications', next), true);
  assert.deepEqual(loadNotificationPreferences(storage, 'notifications'), next);
  values.set('notifications', '{bad json');
  assert.deepEqual(loadNotificationPreferences(storage, 'notifications'), createNotificationPreferences());
});

test('storage failures do not crash notification preference loading or saving', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  assert.deepEqual(loadNotificationPreferences(storage, 'notifications'), createNotificationPreferences());
  assert.equal(saveNotificationPreferences(storage, 'notifications', {}), false);
});
