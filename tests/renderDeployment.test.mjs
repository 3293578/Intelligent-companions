import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('Render staging blueprint uses the Node service, liveness health, and dashboard-owned secrets', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.match(blueprint, /type:\s*web/);
  assert.match(blueprint, /runtime:\s*node/);
  assert.match(blueprint, /region:\s*singapore/);
  assert.match(blueprint, /buildCommand:\s*npm ci/);
  assert.match(blueprint, /startCommand:\s*npm start/);
  assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
  assert.match(blueprint, /NO_LOCAL_PROXY_FALLBACK[\s\S]*value:\s*['"]?1/);
  for (const key of ['APP_ORIGIN', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DEEPSEEK_API_KEY']) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
  }
  assert.match(blueprint, /key:\s*AUTH_RECOVERY_SECRET[\s\S]{0,80}generateValue:\s*true/);
  assert.doesNotMatch(blueprint, /sb_publishable_[a-z0-9_-]{20,}|sk-[a-z0-9_-]{20,}|@qq\.com/i);
});

test('package exposes a production start command and a bounded supported Node range', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server.mjs');
  assert.match(pkg.engines.node, /^>=22 /);
});

test('hosted paid operations use authenticated user and trusted client-IP rate limits', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  assert.match(server, /isMeteredApiPath\(requestUrl\.pathname\)/);
  assert.match(server, /userId:\s*authenticatedUser\.id/);
  assert.match(server, /clientIpFromRequest\(request,\s*\{\s*trustProxy\s*\}\)/);
  assert.match(server, /daily_request_limit/);
  for (const route of ['translate', 'language-assist', 'content', 'chat']) {
    assert.match(server, new RegExp(`requestUrl\\.pathname === ['\"]\\/api\\/${route}['\"]`));
    assert.doesNotMatch(server, new RegExp(`startsWith\\(['\"]\\/api\\/${route}`));
  }
  assert.match(server, /requestUrl\.pathname\.startsWith\(['"]\/api\/['"]\)[\s\S]{0,160}not_found/);
});

test('Supabase auth shares the configured outbound path and LLM has a network-only fallback', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const proxyDeclaration = server.indexOf('const outboundFetch =');
  const authClientDeclaration = server.indexOf('const authClient =');
  assert.ok(proxyDeclaration > -1 && proxyDeclaration < authClientDeclaration);
  assert.match(server, /createSupabaseAuthClient\(\{\s*supabaseUrl,\s*publishableKey:\s*supabasePublishableKey,\s*fetchImpl:\s*outboundFetch\s*\}\)/);
  assert.match(server, /createNetworkFallbackFetch\(\{[\s\S]{0,180}primaryFetch:\s*globalThis\.fetch[\s\S]{0,180}fallbackFetch:\s*outboundFetch/);
});

test('beginner deployment docs consistently use the approved Render path', () => {
  const guide = fs.readFileSync(path.join(root, 'docs/wyth/cloud-setup-for-beginners.md'), 'utf8');
  const inventory = fs.readFileSync(path.join(root, 'docs/wyth/production-secret-inventory.md'), 'utf8');
  assert.match(guide, /Render Blueprint/);
  assert.match(guide, /银行卡验证/);
  assert.doesNotMatch(guide, /Railway/);
  assert.doesNotMatch(inventory, /Railway/);
  assert.match(inventory, /Render staging Environment/);
});
