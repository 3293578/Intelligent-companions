import test from 'node:test';
import assert from 'node:assert/strict';

import { avatarCrop, validateAvatarFile } from '../src/avatarImage.js';

test('accepts supported local avatar image metadata', () => {
  assert.deepEqual(validateAvatarFile({ type: 'image/png', size: 2_000_000 }), { ok: true, error: '' });
});

test('rejects unsupported and oversized avatar files', () => {
  assert.match(validateAvatarFile({ type: 'image/gif', size: 100 }).error, /PNG, JPEG, or WebP/);
  assert.match(validateAvatarFile({ type: 'image/png', size: 9_000_000 }).error, /6 MB/);
});

test('calculates a centered square crop', () => {
  assert.deepEqual(avatarCrop(1200, 800), { sx: 200, sy: 0, size: 800 });
  assert.deepEqual(avatarCrop(600, 900), { sx: 0, sy: 150, size: 600 });
});
