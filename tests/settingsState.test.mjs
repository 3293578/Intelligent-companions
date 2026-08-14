import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FULL_SETTINGS_SECTIONS,
  closeSettings,
  createSettingsState,
  openFullSettings,
  openQuickSettings,
  selectFullSettingsSection,
  updateQuickSetting
} from '../src/settingsState.js';

test('settings persistence can reject a failed write without mutating the next state', async () => {
  const { persistQuickSettings } = await import('../src/settingsState.js');
  const current = createSettingsState();
  const next = updateQuickSetting(current, 'readingMode', 'reading');
  const failed = persistQuickSettings({ setItem() { throw new Error('blocked'); } }, 'settings', current, next);
  assert.deepEqual(failed, { ok: false, state: current });
});

test('settings state has five stable full-settings sections and only frequent quick settings', () => {
  assert.deepEqual(FULL_SETTINGS_SECTIONS, ['account', 'companionship', 'characters', 'language', 'privacy']);
  const state = createSettingsState();
  assert.deepEqual(Object.keys(state.quick), [
    'interfaceLocale',
    'proactiveContact',
    'reduceMotion',
    'readingMode',
    'soundEnabled'
  ]);
  assert.equal(state.surface, 'closed');
  assert.equal(state.activeSection, 'account');
});

test('quick settings normalize supported values without mutating prior state', () => {
  const original = createSettingsState();
  const localized = updateQuickSetting(original, 'interfaceLocale', 'en-US');
  const proactive = updateQuickSetting(localized, 'proactiveContact', 'daily');
  const reading = updateQuickSetting(proactive, 'readingMode', 'reading');
  const quiet = updateQuickSetting(reading, 'soundEnabled', 0);

  assert.equal(original.quick.interfaceLocale, 'zh-CN');
  assert.deepEqual(quiet.quick, {
    interfaceLocale: 'en',
    proactiveContact: 'daily',
    reduceMotion: false,
    readingMode: 'reading',
    soundEnabled: false
  });
});

test('unknown quick settings and values are rejected without polluting state', () => {
  const state = createSettingsState();
  assert.throws(() => updateQuickSetting(state, 'provider', 'deepseek'), /Unknown quick setting/);
  assert.throws(() => updateQuickSetting(state, 'readingMode', 'always'), /Invalid reading mode/);
  assert.throws(() => updateQuickSetting(state, 'proactiveContact', 'hourly'), /Invalid proactive contact/);
  assert.equal('provider' in state.quick, false);
});

test('full settings validates sections and closes back to quick when opened from quick', () => {
  const quick = openQuickSettings(createSettingsState());
  const full = openFullSettings(quick, 'language');
  assert.equal(full.surface, 'full');
  assert.equal(full.activeSection, 'language');
  assert.equal(closeSettings(full).surface, 'quick');
  assert.equal(closeSettings(openFullSettings(createSettingsState(), 'privacy')).surface, 'closed');
  assert.equal(selectFullSettingsSection(full, 'characters').activeSection, 'characters');
  assert.throws(() => openFullSettings(quick, 'billing'), /Unknown settings section/);
});
