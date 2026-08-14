import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureTranscriptView,
  normalizeRelationshipForAge,
  persistInterfaceState,
  restoreTranscriptView
} from '../src/interfaceUiState.js';

test('minor relationship normalization always rejects romantic input and fallback', () => {
  assert.equal(normalizeRelationshipForAge('Girlfriend', 'minor', 'Boyfriend'), 'Bestie');
  assert.equal(normalizeRelationshipForAge('Boyfriend', 'minor', 'Girlfriend'), 'Bestie');
  assert.equal(normalizeRelationshipForAge('Girlfriend', 'minor', 'Mentor'), 'Mentor');
  assert.equal(normalizeRelationshipForAge('Girlfriend', 'adult', 'Bestie'), 'Girlfriend');
  assert.equal(normalizeRelationshipForAge('Mentor', 'minor', 'Bestie'), 'Mentor');
  assert.equal(normalizeRelationshipForAge(' Girlfriend ', 'adult', 'Bestie'), 'Bestie');
  assert.equal(normalizeRelationshipForAge('arbitrary', 'adult', 'Bestie'), 'Bestie');
  assert.equal(normalizeRelationshipForAge('', 'minor', 'Mentor'), 'Mentor');
});

function createStorage({ failOnCall = 0 } = {}) {
  const values = new Map([
    ['wyth-onboarding-v1', 'old-onboarding'],
    ['english-companions-state-v1', 'old-state']
  ]);
  let calls = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      calls += 1;
      if (calls === failOnCall) throw new Error(`failed ${calls}`);
      values.set(key, value);
    },
    values
  };
}

test('interface persistence commits both stores together', () => {
  const storage = createStorage();
  const result = persistInterfaceState(storage, {
    onboardingKey: 'wyth-onboarding-v1',
    onboardingValue: 'new-onboarding',
    stateKey: 'english-companions-state-v1',
    stateValue: 'new-state'
  });
  assert.deepEqual(result, { ok: true, error: '' });
  assert.equal(storage.values.get('wyth-onboarding-v1'), 'new-onboarding');
  assert.equal(storage.values.get('english-companions-state-v1'), 'new-state');
});

test('interface persistence leaves both stores unchanged when first write fails', () => {
  const storage = createStorage({ failOnCall: 1 });
  const result = persistInterfaceState(storage, {
    onboardingKey: 'wyth-onboarding-v1', onboardingValue: 'new-onboarding',
    stateKey: 'english-companions-state-v1', stateValue: 'new-state'
  });
  assert.equal(result.ok, false);
  assert.equal(storage.values.get('wyth-onboarding-v1'), 'old-onboarding');
  assert.equal(storage.values.get('english-companions-state-v1'), 'old-state');
});

test('interface persistence rolls back the first store when second write fails', () => {
  const storage = createStorage({ failOnCall: 2 });
  const result = persistInterfaceState(storage, {
    onboardingKey: 'wyth-onboarding-v1', onboardingValue: 'new-onboarding',
    stateKey: 'english-companions-state-v1', stateValue: 'new-state'
  });
  assert.equal(result.ok, false);
  assert.equal(storage.values.get('wyth-onboarding-v1'), 'old-onboarding');
  assert.equal(storage.values.get('english-companions-state-v1'), 'old-state');
});

test('interface persistence does not write when either snapshot read fails', () => {
  for (const failRead of [1, 2]) {
    let reads = 0;
    let writes = 0;
    const storage = {
      getItem() {
        reads += 1;
        if (reads === failRead) throw new DOMException('Denied', 'SecurityError');
        return 'old';
      },
      setItem() { writes += 1; }
    };
    assert.deepEqual(persistInterfaceState(storage, {
      onboardingKey: 'onboarding', onboardingValue: 'new-onboarding',
      stateKey: 'state', stateValue: 'new-state'
    }), { ok: false, errorKey: 'storage.unavailable' });
    assert.equal(writes, 0);
  }
});

test('interface persistence contains rollback failures', () => {
  let writes = 0;
  const storage = {
    getItem() { return 'old'; },
    setItem() {
      writes += 1;
      if (writes >= 2) throw new Error('write or rollback failed');
    }
  };
  assert.doesNotThrow(() => persistInterfaceState(storage, {
    onboardingKey: 'onboarding', onboardingValue: 'new-onboarding',
    stateKey: 'state', stateValue: 'new-state'
  }));
  assert.equal(persistInterfaceState(storage, {
    onboardingKey: 'onboarding', onboardingValue: 'new-onboarding',
    stateKey: 'state', stateValue: 'new-state'
  }).ok, false);
});

test('transcript view keeps bottom pinning or bottom distance across rerenders', () => {
  const atBottom = captureTranscriptView({ scrollHeight: 1000, scrollTop: 500, clientHeight: 500 });
  assert.equal(atBottom.atBottom, true);
  assert.equal(restoreTranscriptView(atBottom, { scrollHeight: 1400, clientHeight: 500 }), 900);

  const reading = captureTranscriptView({ scrollHeight: 1000, scrollTop: 300, clientHeight: 500 });
  assert.deepEqual(reading, { atBottom: false, bottomDistance: 200 });
  assert.equal(restoreTranscriptView(reading, { scrollHeight: 1400, clientHeight: 500 }), 700);
});
