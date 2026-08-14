import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('Render staging blueprint uses the Node service, liveness health, and dashboard-owned secrets', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.match(blueprint, /type:\s*web/);
  assert.match(blueprint, /runtime:\s*node/);
  assert.match(blueprint, /buildCommand:\s*npm ci/);
  assert.match(blueprint, /startCommand:\s*npm start/);
  assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
  assert.match(blueprint, /NO_LOCAL_PROXY_FALLBACK[\s\S]*value:\s*['"]?1/);
  for (const key of ['APP_ORIGIN', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_RECOVERY_SECRET', 'DEEPSEEK_API_KEY']) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
  }
  assert.doesNotMatch(blueprint, /sb_publishable_[a-z0-9_-]{20,}|sk-[a-z0-9_-]{20,}|@qq\.com/i);
});

test('package exposes a production start command and a bounded supported Node range', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server.mjs');
  assert.match(pkg.engines.node, /^>=22 /);
});
