import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONBOARDING_VERSION,
  calculateAge,
  createOnboardingState,
  deserializeOnboardingState,
  normalizeBirthday,
  saveBirthday,
  setInterfaceLocale,
  updateProgressiveProfile
} from '../src/onboardingState.js';

const NOW = '2026-07-14';

test('creates a safe versioned onboarding state', () => {
  assert.deepEqual(createOnboardingState(), {
    version: ONBOARDING_VERSION,
    stage: 'language',
    interfaceLocale: 'zh-CN',
    birthday: '',
    ageGroup: 'unknown',
    romanceAllowed: false,
    profile: {
      gender: '',
      preferredCompanionGender: '',
      proactiveContact: null
    },
    completed: false
  });
  assert.equal(ONBOARDING_VERSION, 1);
});

test('validates real ISO birthdays and rejects malformed calendar dates', () => {
  assert.deepEqual(normalizeBirthday('2008-07-15', NOW), {
    ok: true,
    value: '2008-07-15',
    error: ''
  });
  assert.equal(normalizeBirthday('07/15/2008', NOW).ok, false);
  assert.equal(normalizeBirthday('2025-02-29', NOW).ok, false);
  assert.equal(normalizeBirthday('2000-13-01', NOW).ok, false);
  assert.equal(normalizeBirthday('', NOW).ok, false);
});

test('accepts leap-day birthdays and rejects future or implausibly old dates', () => {
  assert.equal(normalizeBirthday('2004-02-29', NOW).ok, true);
  assert.equal(normalizeBirthday('2027-01-01', NOW).ok, false);
  assert.equal(normalizeBirthday('1900-01-01', NOW).ok, false);
  assert.equal(normalizeBirthday('1906-07-14', NOW).ok, true);
});

test('calculates age at birthday boundaries using the explicit date', () => {
  assert.equal(calculateAge('2008-07-14', NOW), 18);
  assert.equal(calculateAge('2008-07-15', NOW), 17);
  assert.equal(calculateAge('2008-07-13', NOW), 18);
  assert.equal(calculateAge('2008-02-29', '2026-02-28'), 17);
  assert.equal(calculateAge('2008-02-29', '2026-03-01'), 18);
});

test('uses the calendar date expressed by extreme timezone offsets', () => {
  assert.equal(calculateAge('2008-07-15', '2026-07-14T23:30:00-12:00'), 17);
  assert.equal(calculateAge('2008-07-15', '2026-07-15T00:30:00+14:00'), 18);
});

test('rejects invalid reference calendar dates instead of accepting rollover', () => {
  assert.equal(calculateAge('2008-07-15', '2026-02-30'), null);
  assert.equal(calculateAge('2008-07-15', 'not-a-date'), null);
  assert.equal(calculateAge('2008-07-15', '2026-07-14Tgarbage'), null);
  assert.equal(calculateAge('2008-07-15', '2026-07-14T25:00:00+08:00'), null);
  assert.equal(normalizeBirthday('2008-07-15', '2026-02-30').error, 'invalid_reference_date');
});

test('saves a minor birthday and cannot opt the minor into romance', () => {
  const state = saveBirthday(createOnboardingState({ romanceAllowed: true }), '2010-01-01', NOW);

  assert.equal(state.birthday, '2010-01-01');
  assert.equal(state.ageGroup, 'minor');
  assert.equal(state.romanceAllowed, false);
  assert.equal(state.stage, 'companion');
});

test('saves an adult birthday and derives romance eligibility', () => {
  const state = saveBirthday(createOnboardingState(), '2008-07-14', NOW);

  assert.equal(state.ageGroup, 'adult');
  assert.equal(state.romanceAllowed, true);
  assert.equal(state.stage, 'companion');
});

test('cannot create or preserve adult authorization without a verified birthday', () => {
  const forged = createOnboardingState({
    ageGroup: 'adult',
    romanceAllowed: true,
    stage: 'complete',
    completed: true
  });
  const changedLocale = setInterfaceLocale(forged, 'en');
  const changedProfile = updateProgressiveProfile(forged, { gender: 'woman' });

  for (const state of [forged, changedLocale, changedProfile]) {
    assert.equal(state.birthday, '');
    assert.equal(state.ageGroup, 'unknown');
    assert.equal(state.romanceAllowed, false);
  }

  const invalidSave = saveBirthday({
    ...forged,
    birthday: '2000-01-01',
    ageGroup: 'adult',
    romanceAllowed: true
  }, '2027-01-01', NOW);
  assert.equal(invalidSave.ageGroup, 'unknown');
  assert.equal(invalidSave.romanceAllowed, false);
});

test('locale and progressive profile edits preserve a verified age state', () => {
  const adult = saveBirthday(createOnboardingState(), '2000-01-01', NOW);
  const localized = setInterfaceLocale(adult, 'en');
  const profiled = updateProgressiveProfile(localized, { gender: 'woman' });

  for (const state of [localized, profiled]) {
    assert.equal(state.birthday, '2000-01-01');
    assert.equal(state.ageGroup, 'adult');
    assert.equal(state.romanceAllowed, true);
  }
});

test('rejects an invalid birthday without corrupting the current state', () => {
  const initial = saveBirthday(createOnboardingState(), '2000-01-01', NOW);
  const updated = saveBirthday(initial, '2027-01-01', NOW);

  assert.deepEqual(updated, initial);
});

test('normalizes the interface locale and advances from language to birthday', () => {
  const english = setInterfaceLocale(createOnboardingState(), 'EN_gb');
  const fallback = setInterfaceLocale(english, 'fr');

  assert.equal(english.interfaceLocale, 'en');
  assert.equal(english.stage, 'birthday');
  assert.equal(fallback.interfaceLocale, 'zh-CN');
});

test('progressive profile fields are optional, editable, and preserve omitted fields', () => {
  const initial = createOnboardingState();
  const updated = updateProgressiveProfile(initial, {
    gender: 'woman',
    preferredCompanionGender: 'man',
    proactiveContact: true
  });
  const edited = updateProgressiveProfile(updated, { gender: 'prefer_not_to_say' });

  assert.deepEqual(updated.profile, {
    gender: 'woman',
    preferredCompanionGender: 'man',
    proactiveContact: true
  });
  assert.deepEqual(edited.profile, {
    gender: 'prefer_not_to_say',
    preferredCompanionGender: 'man',
    proactiveContact: true
  });
});

test('progressive profile safely ignores invalid values and permits clearing fields', () => {
  const initial = updateProgressiveProfile(createOnboardingState(), {
    gender: 'non_binary',
    preferredCompanionGender: 'neutral',
    proactiveContact: false
  });
  const invalid = updateProgressiveProfile(initial, {
    gender: 'robot',
    preferredCompanionGender: 'anyone',
    proactiveContact: 'yes'
  });
  const cleared = updateProgressiveProfile(invalid, {
    gender: '',
    preferredCompanionGender: '',
    proactiveContact: null
  });

  assert.deepEqual(invalid.profile, initial.profile);
  assert.deepEqual(cleared.profile, {
    gender: '',
    preferredCompanionGender: '',
    proactiveContact: null
  });
});

test('deserializes empty and malformed input to safe defaults', () => {
  assert.deepEqual(deserializeOnboardingState('', NOW), createOnboardingState());
  assert.deepEqual(deserializeOnboardingState('{bad json', NOW), createOnboardingState());
  assert.deepEqual(deserializeOnboardingState('[]', NOW), createOnboardingState());
});

test('migrates old and partial onboarding states into the current contract', () => {
  const restored = deserializeOnboardingState(JSON.stringify({
    version: 0,
    locale: 'en-US',
    birthDate: '2000-02-29',
    gender: 'man',
    preferredGender: 'woman',
    proactiveContact: true,
    stage: 'profile',
    completed: true
  }), NOW);

  assert.equal(restored.version, ONBOARDING_VERSION);
  assert.equal(restored.interfaceLocale, 'en');
  assert.equal(restored.birthday, '2000-02-29');
  assert.equal(restored.ageGroup, 'adult');
  assert.equal(restored.romanceAllowed, true);
  assert.deepEqual(restored.profile, {
    gender: 'man',
    preferredCompanionGender: 'woman',
    proactiveContact: true
  });
  assert.equal(restored.stage, 'profile');
  assert.equal(restored.completed, true);
});

test('re-derives minor restrictions instead of trusting stored authorization', () => {
  const restored = deserializeOnboardingState(JSON.stringify({
    version: ONBOARDING_VERSION,
    birthday: '2010-01-01',
    ageGroup: 'adult',
    romanceAllowed: true,
    profile: { gender: 'woman', preferredCompanionGender: 'man' }
  }), NOW);

  assert.equal(restored.ageGroup, 'minor');
  assert.equal(restored.romanceAllowed, false);
});

test('drops invalid persisted profile and birthday values safely', () => {
  const restored = deserializeOnboardingState(JSON.stringify({
    birthday: '2027-01-01',
    ageGroup: 'adult',
    romanceAllowed: true,
    interfaceLocale: 'xx',
    profile: {
      gender: 'invalid',
      preferredCompanionGender: 'invalid',
      proactiveContact: 'true'
    }
  }), NOW);

  assert.equal(restored.birthday, '');
  assert.equal(restored.ageGroup, 'unknown');
  assert.equal(restored.romanceAllowed, false);
  assert.equal(restored.interfaceLocale, 'zh-CN');
  assert.deepEqual(restored.profile, createOnboardingState().profile);
  assert.equal(restored.stage, 'birthday');
  assert.equal(restored.completed, false);
});

test('missing birthday cannot restore later progress or truthy completion values', () => {
  for (const completed of ['true', 1, {}, true]) {
    const restored = deserializeOnboardingState(JSON.stringify({
      stage: 'complete',
      completed,
      ageGroup: 'adult',
      romanceAllowed: true
    }), NOW);

    assert.equal(restored.stage, 'birthday');
    assert.equal(restored.completed, false);
    assert.equal(restored.ageGroup, 'unknown');
    assert.equal(restored.romanceAllowed, false);
  }
});

test('valid birthday restores only whitelisted stage and strict boolean completion', () => {
  const invalidStage = deserializeOnboardingState(JSON.stringify({
    birthday: '2000-01-01', stage: 'admin', completed: true
  }), NOW);
  const stringCompletion = deserializeOnboardingState(JSON.stringify({
    birthday: '2000-01-01', stage: 'profile', completed: 'true'
  }), NOW);

  assert.equal(invalidStage.stage, 'companion');
  assert.equal(invalidStage.completed, true);
  assert.equal(stringCompletion.stage, 'profile');
  assert.equal(stringCompletion.completed, false);
});
