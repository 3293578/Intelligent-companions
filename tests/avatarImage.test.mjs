import test from 'node:test';
import assert from 'node:assert/strict';

import { avatarCrop, processAvatarFile, validateAvatarFile } from '../src/avatarImage.js';

test('accepts supported local avatar image metadata', () => {
  assert.deepEqual(validateAvatarFile({ type: 'image/png', size: 2_000_000 }), { ok: true, error: '' });
});

test('avatar processing revokes its object URL when image loading fails', async () => {
  const revoked = [];
  class BrokenImage {
    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onerror());
    }
    get src() { return this._src; }
  }
  const env = {
    Image: BrokenImage,
    URL: {
      createObjectURL: () => 'blob:broken',
      revokeObjectURL: (value) => revoked.push(value)
    }
  };

  await assert.rejects(() => processAvatarFile({ type: 'image/png', size: 10 }, env), /Could not read/);
  assert.deepEqual(revoked, ['blob:broken']);
});

test('avatar processing revokes its object URL when canvas drawing fails', async () => {
  const revoked = [];
  class LoadedImage {
    set src(value) {
      this._src = value;
      this.naturalWidth = 100;
      this.naturalHeight = 100;
      queueMicrotask(() => this.onload());
    }
    get src() { return this._src; }
  }
  const env = {
    Image: LoadedImage,
    URL: { createObjectURL: () => 'blob:draw', revokeObjectURL: (value) => revoked.push(value) },
    document: { createElement: () => ({ getContext: () => ({ drawImage: () => { throw new Error('draw failed'); } }) }) }
  };

  await assert.rejects(() => processAvatarFile({ type: 'image/png', size: 10 }, env), /draw failed/);
  assert.deepEqual(revoked, ['blob:draw']);
});

test('rejects unsupported and oversized avatar files', () => {
  assert.match(validateAvatarFile({ type: 'image/gif', size: 100 }).error, /PNG, JPEG, or WebP/);
  assert.match(validateAvatarFile({ type: 'image/png', size: 9_000_000 }).error, /6 MB/);
});

test('calculates a centered square crop', () => {
  assert.deepEqual(avatarCrop(1200, 800), { sx: 200, sy: 0, size: 800 });
  assert.deepEqual(avatarCrop(600, 900), { sx: 0, sy: 150, size: 600 });
});
