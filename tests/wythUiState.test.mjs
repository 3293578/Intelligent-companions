import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginCompanionTransition,
  completeCompanionTransition,
  createWythUiState,
  resolveMotionPreference,
  setHistoryReading,
  setReadingMode,
  setSupportPresence
} from '../src/wythUiState.js';

test('support presence accepts only known non-diagnostic presentation states', () => {
  const initial = createWythUiState();
  assert.equal(initial.supportPresence, 'none');
  assert.equal(setSupportPresence(initial, 'avatar_close').supportPresence, 'avatar_close');
  assert.equal(setSupportPresence(initial, 'half_body').supportPresence, 'half_body');
  assert.throws(() => setSupportPresence(initial, 'diagnosed'), /Unknown support presence/);
});

test('history reading is an automatic presentation state', () => {
  assert.equal(setHistoryReading(createWythUiState(), true).historyReading, true);
  assert.equal(setHistoryReading(createWythUiState(), false).historyReading, false);
});

test('manual reading mode overrides automatic transcript history while preserving compatibility', () => {
  const automatic = setHistoryReading(createWythUiState(), true);
  assert.equal(automatic.readingMode, 'auto');
  assert.equal(automatic.historyReading, true);

  const scene = setReadingMode(automatic, 'scene');
  assert.equal(scene.historyReading, false);
  assert.equal(setHistoryReading(scene, true).historyReading, false);

  const reading = setReadingMode(scene, 'reading');
  assert.equal(reading.historyReading, true);
  assert.equal(setHistoryReading(reading, false).historyReading, true);
  assert.throws(() => setReadingMode(reading, 'always'), /Invalid reading mode/);
});

test('companion transitions reset only automatic reading state', () => {
  const automatic = setHistoryReading(createWythUiState(), true);
  const manual = setReadingMode(createWythUiState(), 'reading');
  assert.equal(beginCompanionTransition(automatic, 'a', 'b').historyReading, false);
  assert.equal(beginCompanionTransition(manual, 'a', 'b').historyReading, true);
});

test('a new companion transition replaces an in-flight transition', () => {
  const first = beginCompanionTransition(createWythUiState(), 'a', 'b', 1);
  const second = beginCompanionTransition(first, 'b', 'c', -1);

  assert.equal(second.transition.toId, 'c');
  assert.equal(second.transition.direction, -1);
  assert.ok(second.transition.token > first.transition.token);
});

test('only the active transition token can complete', () => {
  const active = beginCompanionTransition(createWythUiState(), 'a', 'b', 1);
  assert.equal(completeCompanionTransition(active, active.transition.token - 1).transition.phase, 'leaving');
  assert.equal(completeCompanionTransition(active, active.transition.token).transition.phase, 'idle');
});

test('explicit motion preference overrides the operating system', () => {
  assert.equal(resolveMotionPreference('reduce', false), true);
  assert.equal(resolveMotionPreference('full', true), false);
  assert.equal(resolveMotionPreference('', true), true);
});
