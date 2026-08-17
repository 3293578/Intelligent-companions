import test from 'node:test';
import assert from 'node:assert/strict';

import { accountStorageKey, migrateGuestStorage } from '../src/accountStorage.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

test('authenticated storage keys are stable and isolated from guest and other users', () => {
  assert.equal(accountStorageKey('wyth-state', ''), 'wyth-state');
  assert.equal(accountStorageKey('wyth-state', 'user-a'), 'wyth-state:account:user-a');
  assert.equal(accountStorageKey('wyth-state', 'user-b'), 'wyth-state:account:user-b');
  assert.throws(() => accountStorageKey('wyth-state', '../bad'), /invalid_storage_owner/);
});

test('first authenticated account adopts legacy guest data and removes the shared copy', () => {
  const storage = memoryStorage({ state: 'private-chat', settings: 'private-settings' });
  const result = migrateGuestStorage(storage, ['state', 'settings'], 'user-a');
  assert.deepEqual(result, { migrated: 2, removed: 2 });
  assert.deepEqual(storage.snapshot(), {
    'state:account:user-a': 'private-chat',
    'settings:account:user-a': 'private-settings'
  });
});

test('migration preserves recoverable guest data when the account namespace already exists', () => {
  const storage = memoryStorage({ state: 'guest-chat', 'state:account:user-a': 'account-chat' });
  const result = migrateGuestStorage(storage, ['state'], 'user-a');
  assert.deepEqual(result, { migrated: 0, removed: 0 });
  assert.deepEqual(storage.snapshot(), {
    state: 'guest-chat',
    'state:account:user-a': 'account-chat'
  });
});

test('A logout and B login cannot resolve A account data through shared keys', () => {
  const storage = memoryStorage({ state: 'a-legacy-chat' });
  migrateGuestStorage(storage, ['state'], 'user-a');
  assert.equal(storage.getItem(accountStorageKey('state', '')), null);
  assert.equal(storage.getItem(accountStorageKey('state', 'user-a')), 'a-legacy-chat');
  assert.equal(storage.getItem(accountStorageKey('state', 'user-b')), null);
});
