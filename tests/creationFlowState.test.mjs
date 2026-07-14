import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVANCED_STEPS,
  createCreationFlow,
  goToCreationStep,
  validateCreationStep,
  canSubmitCreation,
  updateCreationDraft
} from '../src/creationFlowState.js';

test('creation flow starts in quick identity mode with safe commercial defaults', () => {
  const flow = createCreationFlow();

  assert.deepEqual(ADVANCED_STEPS, [
    'identity', 'relationship', 'personality', 'story', 'language', 'voice_scene', 'review'
  ]);
  assert.equal(flow.mode, 'quick');
  assert.equal(flow.step, 'identity');
  assert.deepEqual(Object.keys(flow.draft), [
    'name', 'relationshipType', 'personality', 'backgroundStory', 'language',
    'sceneId', 'avatar', 'visualStyle', 'voiceId'
  ]);
  assert.equal(flow.draft.visualStyle, 'cinematic_semireal');
  assert.equal(flow.draft.voiceId, '');
  assert.equal(flow.draft.backgroundStory, '');
});

test('advanced creation validates each step and can submit only from review', () => {
  const emptyName = createCreationFlow({ mode: 'advanced', draft: { name: '   ' } });
  assert.deepEqual(validateCreationStep(emptyName), { ok: false, error: 'name_required', field: 'name' });
  assert.equal(canSubmitCreation(emptyName), false);

  const invalidRelationship = goToCreationStep(updateCreationDraft(emptyName, { name: 'Mia', relationshipType: 'Owner' }), 'relationship');
  assert.deepEqual(validateCreationStep(invalidRelationship), { ok: false, error: 'relationship_invalid', field: 'relationshipType' });

  const minorRomance = { ...invalidRelationship, draft: { ...invalidRelationship.draft, relationshipType: 'Girlfriend' } };
  assert.deepEqual(validateCreationStep(minorRomance, { ageGroup: 'minor' }), { ok: false, error: 'relationship_minor', field: 'relationshipType' });

  const emptyPersonality = goToCreationStep(updateCreationDraft(emptyName, { name: 'Mia', personality: '' }), 'personality');
  assert.deepEqual(validateCreationStep(emptyPersonality), { ok: false, error: 'personality_required', field: 'personality' });

  const invalidLanguage = goToCreationStep(updateCreationDraft(emptyName, { name: 'Mia', language: 'klingon' }), 'language');
  assert.deepEqual(validateCreationStep(invalidLanguage), { ok: false, error: 'language_invalid', field: 'language' });

  const invalidScene = goToCreationStep(updateCreationDraft(emptyName, { name: 'Mia', sceneId: 'moon' }), 'voice_scene');
  assert.deepEqual(validateCreationStep(invalidScene), { ok: false, error: 'scene_invalid', field: 'sceneId' });

  const review = goToCreationStep(updateCreationDraft(emptyName, { name: 'Mia' }), 'review');
  assert.deepEqual(validateCreationStep(review), { ok: true });
  assert.equal(canSubmitCreation(review), true);
});

test('creation draft preserves unavailable stored visual and voice values', () => {
  const flow = createCreationFlow({ mode: 'advanced', draft: {
    visualStyle: 'digital_human', voiceId: 'legacy_warm_voice'
  } });
  const edited = updateCreationDraft(flow, { name: 'Still Mia' });

  assert.equal(edited.draft.visualStyle, 'digital_human');
  assert.equal(edited.draft.voiceId, 'legacy_warm_voice');
});

test('creation flow preserves draft values across forward and backward steps', () => {
  const named = updateCreationDraft(createCreationFlow(), {
    name: 'Mia', backgroundStory: 'Met beside a rainy bookshop.'
  });
  const review = goToCreationStep(named, 'review');
  const back = goToCreationStep(review, 'identity');

  assert.equal(back.draft.name, 'Mia');
  assert.equal(back.draft.backgroundStory, 'Met beside a rainy bookshop.');
});

test('creation flow rejects unknown steps and ignores untrusted draft keys', () => {
  const flow = updateCreationDraft(createCreationFlow(), {
    name: 'Aki', admin: true, pushCategories: ['secret']
  });

  assert.equal(flow.draft.name, 'Aki');
  assert.equal(Object.hasOwn(flow.draft, 'admin'), false);
  assert.equal(Object.hasOwn(flow.draft, 'pushCategories'), false);
  assert.throws(() => goToCreationStep(flow, 'billing'), /Unknown creation step/);
});
