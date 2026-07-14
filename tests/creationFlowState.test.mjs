import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVANCED_STEPS,
  createCreationFlow,
  goToCreationStep,
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

