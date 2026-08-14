import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAmbientDescriptor,
  resolveSceneTime,
  resolveSupportVisual
} from '../src/scenePresentation.js';

test('maps local hour to morning, dusk, or night', () => {
  assert.equal(resolveSceneTime(8), 'morning');
  assert.equal(resolveSceneTime(18), 'dusk');
  assert.equal(resolveSceneTime(1), 'night');
});

test('uses scene-specific atmosphere rather than generic dust', () => {
  assert.equal(resolveAmbientDescriptor('listener_rain').kind, 'rain');
  assert.equal(resolveAmbientDescriptor('traveler_train').kind, 'passing_light');
  assert.equal(resolveAmbientDescriptor('workmate_desk').kind, 'city_glow');
  assert.equal(resolveAmbientDescriptor('coach_study').kind, 'page_light');
  assert.equal(resolveAmbientDescriptor('friend_room').kind, 'curtain_dust');
});

test('reduced motion returns a static support visual', () => {
  assert.equal(resolveSupportVisual('half_body', { reduceMotion: true }).motion, 'static');
  assert.equal(resolveSupportVisual('half_body', { reduceMotion: false }).motion, 'transform');
});
