import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessSupportSignal,
  requestManualSupport,
  resolveSupportPresence
} from '../src/emotionSupport.js';

test('one ambiguous negative word does not force character presence', () => {
  assert.equal(assessSupportSignal([
    { role: 'user', content: 'This battery is dead.' }
  ]).level, 'none');
});

test('repeated personal fatigue produces a strong support signal', () => {
  const signal = assessSupportSignal([
    { role: 'user', content: '我今天真的很累。' },
    { role: 'assistant', content: '我在听。' },
    { role: 'user', content: '什么都不想做，只想有人陪着。' }
  ]);

  assert.equal(signal.level, 'strong');
  assert.equal(signal.suppressLearning, true);
  assert.equal(resolveSupportPresence(signal, { reduceMotion: false }), 'half_body');
});

test('manual support overrides uncertainty but not a crisis state', () => {
  assert.equal(requestManualSupport().level, 'manual');
  assert.equal(
    resolveSupportPresence({ level: 'crisis' }, { reduceMotion: false }),
    'crisis_static'
  );
});
