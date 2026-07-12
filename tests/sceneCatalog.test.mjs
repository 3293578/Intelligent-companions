import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCENE_CATALOG,
  WYTH_PRESETS,
  fallbackSceneId,
  recommendSceneId,
  sceneForId
} from '../src/sceneCatalog.js';

test('defines five connected Wyth scenes with approved asset destinations and fallbacks', () => {
  assert.deepEqual(Object.keys(SCENE_CATALOG), [
    'friend_room', 'listener_rain', 'traveler_train', 'workmate_desk', 'coach_study'
  ]);
  for (const scene of Object.values(SCENE_CATALOG)) {
    assert.match(scene.baseAsset, /^assets\/wyth\/scenes\/.+\.webp$/);
    assert.equal(scene.fallback.colors.length, 3);
    assert.ok(scene.ambientEffect);
  }
});

test('defines the five approved companionship-first presets', () => {
  assert.deepEqual(WYTH_PRESETS.map((preset) => preset.labelZh), [
    '知心朋友', '安静倾听者', '旅行伙伴', '职场搭档', '温柔语言教练'
  ]);
  assert.equal(WYTH_PRESETS.find((preset) => preset.id === 'listener')?.careStyle.supportMode, 'listen_first');
});

test('recommends deterministic scenes from relationship and personality', () => {
  assert.equal(recommendSceneId({ relationshipType: 'Tree hole', personality: 'Quiet listener' }), 'listener_rain');
  assert.equal(recommendSceneId({ relationshipType: 'Mentor', personality: 'Professional partner' }), 'workmate_desk');
  assert.equal(recommendSceneId({ relationshipType: 'Bestie', personality: 'Warm' }), 'friend_room');
});

test('falls back safely for missing scene identifiers', () => {
  assert.equal(fallbackSceneId(), 'friend_room');
  assert.equal(sceneForId('missing').id, 'friend_room');
});
