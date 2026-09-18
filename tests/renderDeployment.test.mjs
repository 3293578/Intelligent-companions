import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

for (const [file, name, origin, autoDeploy] of [
  ['render.yaml', 'wyth-staging', 'https://staging.thewyth.com', 'commit'],
  ['render.production.yaml', 'wyth-production', 'https://thewyth.com', 'off']
]) {
  test(`${name} blueprint deploys free BYOK without platform model or payment secrets`, () => {
    const blueprint = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(blueprint, new RegExp(`name:\\s*${name}`));
    assert.match(blueprint, /runtime:\s*node/);
    assert.match(blueprint, /region:\s*singapore/);
    assert.match(blueprint, /startCommand:\s*npm start/);
    assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
    assert.match(blueprint, new RegExp(`autoDeployTrigger:\\s*${autoDeploy}`));
    assert.match(blueprint, new RegExp(`value:\\s*${origin.replaceAll('.', '\\.')}`));
    for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
      assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]{0,80}sync:\\s*false`));
    }
    assert.doesNotMatch(blueprint, /DEEPSEEK_API_KEY|PADDLE_|COMMERCE_REQUIRED|STANDARD_ALLOWANCE_USD|SUPABASE_SECRET_KEY/);
  });
}

test('package exposes a production start command and a bounded supported Node range', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server.mjs');
  assert.match(pkg.engines.node, /^>=22 /);
});

test('BYOK operations retain authentication, origin checks, rate limits, and concurrency limits', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  assert.match(server, /request\.headers\.origin !== appOrigin/);
  assert.match(server, /resolveAuthenticatedUser/);
  assert.match(server, /apiUsageLimiter\.consume/);
  assert.match(server, /createConcurrencyGate/);
  assert.match(server, /daily_request_limit/);
  assert.match(server, /modelPaths\.has\(requestUrl\.pathname\)/);
  assert.match(server, /requestUrl\.pathname\.startsWith\(['"]\/api\/['"]\)[\s\S]{0,160}not_found/);
});

test('user-selected model traffic uses a pinned secure relay without operator fallback', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const relay = fs.readFileSync(path.join(root, 'src/byok.js'), 'utf8');
  assert.match(server, /allowEnvironment:\s*false/);
  assert.match(server, /createByokFetch\(config\)/);
  assert.match(relay, /protocol !== 'https:'/);
  assert.match(relay, /records\.some\(\(\{ address \}\) => !isPublicIPv4\(address\)\)/);
  assert.match(relay, /model_redirect_not_allowed/);
  assert.match(relay, /model_response_too_large/);
});

test('Supabase auth alone may use the operator outbound proxy', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const proxyDeclaration = server.indexOf('const outboundFetch =');
  const authClientDeclaration = server.indexOf('const authClient =');
  assert.ok(proxyDeclaration > -1 && proxyDeclaration < authClientDeclaration);
  assert.match(server, /createSupabaseAuthClient\(\{\s*supabaseUrl,\s*publishableKey:\s*supabasePublishableKey,\s*fetchImpl:\s*outboundFetch\s*\}\)/);
  assert.doesNotMatch(server, /createNetworkFallbackFetch/);
}

);
