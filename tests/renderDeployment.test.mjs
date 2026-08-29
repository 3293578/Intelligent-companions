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
  assert.match(blueprint, /autoDeployTrigger:\s*commit/);
  assert.match(blueprint, /NO_LOCAL_PROXY_FALLBACK[\s\S]*value:\s*['"]?1/);
  for (const key of ['APP_ORIGIN', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'DEEPSEEK_API_KEY']) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
  }
  for (const key of ['PADDLE_API_KEY', 'PADDLE_CLIENT_TOKEN', 'PADDLE_WEBHOOK_SECRET']) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
  }
  assert.match(blueprint, /key:\s*PADDLE_ENVIRONMENT[\s\S]{0,80}value:\s*sandbox/);
  assert.match(blueprint, /key:\s*PADDLE_STANDARD_PRICE_ID[\s\S]{0,100}pri_01kzszqc8792n88p0c90jd5r8c/);
  assert.match(blueprint, /key:\s*PADDLE_UNLIMITED_PRICE_ID[\s\S]{0,100}pri_01kzszytcn2m8wdsgbqeasyrbh/);
  assert.match(blueprint, /key:\s*AUTH_RECOVERY_SECRET[\s\S]{0,80}generateValue:\s*true/);
  assert.match(blueprint, /key:\s*COMMERCE_REQUIRED[\s\S]{0,80}value:\s*['"]?0/);
  assert.match(blueprint, /key:\s*LLM_MODEL[\s\S]{0,80}value:\s*deepseek-v4-flash/);
  assert.doesNotMatch(blueprint, /sb_publishable_[a-z0-9_-]{20,}|sk-[a-z0-9_-]{20,}|@qq\.com/i);
});

test('Render production blueprint is isolated, paid, review-gated, and live-commerce only', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.production.yaml'), 'utf8');
  assert.match(blueprint, /name:\s*wyth-production/);
  assert.match(blueprint, /plan:\s*starter/);
  assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
  assert.match(blueprint, /autoDeployTrigger:\s*off/);
  assert.match(blueprint, /key:\s*APP_ORIGIN[\s\S]{0,80}value:\s*https:\/\/thewyth\.com/);
  assert.match(blueprint, /key:\s*COMMERCE_REQUIRED[\s\S]{0,80}value:\s*['"]?1/);
  assert.match(blueprint, /key:\s*PADDLE_ENVIRONMENT[\s\S]{0,80}value:\s*production/);
  for (const key of [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'DEEPSEEK_API_KEY',
    'PADDLE_API_KEY',
    'PADDLE_CLIENT_TOKEN',
    'PADDLE_WEBHOOK_SECRET',
    'PADDLE_STANDARD_PRICE_ID',
    'PADDLE_UNLIMITED_PRICE_ID'
  ]) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
  }
  assert.doesNotMatch(blueprint, /pri_01kz|PADDLE_ENVIRONMENT[\s\S]{0,80}sandbox/);
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

test('Paddle checkout is authenticated while the raw signed webhook endpoint is public', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  assert.match(server, /createBillingRouteHandler/);
  assert.match(server, /requestUrl\.pathname === ['"]\/api\/billing\/checkout['"]/);
  assert.match(server, /requestUrl\.pathname === ['"]\/api\/billing\/paddle\/webhook['"]/);
  assert.match(server, /paddle-signature/);
  assert.match(server, /await readBody\(request\)/);
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
