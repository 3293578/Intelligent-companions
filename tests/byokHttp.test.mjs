import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function startServer(t, { production = false, limit = 1000 } = {}) {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = production ? 'https://thewyth.com' : `http://127.0.0.1:${port}`;
  let logs = '';
  const child = spawn(process.execPath, ['server.mjs', '--port', String(port)], {
    cwd: root, windowsHide: true,
    env: {
      ...process.env, NODE_ENV: production ? 'production' : 'test', HOST: '127.0.0.1', APP_ORIGIN: origin,
      SUPABASE_URL: production ? 'https://auth.wyth.test' : '',
      SUPABASE_PUBLISHABLE_KEY: production ? 'sb_publishable_01234567890123456789' : '',
      AUTH_RECOVERY_SECRET: production ? '0123456789012345678901234567890123456789' : '',
      DEEPSEEK_API_KEY: 'operator-key-must-never-be-used',
      LLM_API_KEY: 'operator-key-must-never-be-used', COMMERCE_REQUIRED: '1',
      NO_LOCAL_PROXY_FALLBACK: '1', HTTPS_PROXY: '', HTTP_PROXY: '', ALL_PROXY: '',
      LLM_RATE_LIMIT_PER_MINUTE: String(limit), LLM_IP_RATE_LIMIT_PER_MINUTE: String(limit), LLM_DAILY_REQUEST_LIMIT: '10000'
    }, stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill(); await exited;
    }
    assert.doesNotMatch(logs, /operator-key-must-never-be-used|private-user-secret/);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server startup deadline')), 10000);
    const interval = setInterval(() => {
      if (logs.includes('Wyth listening')) { clearInterval(interval); clearTimeout(timer); resolve(); }
      else if (child.exitCode !== null) { clearInterval(interval); clearTimeout(timer); reject(new Error('Test server exited')); }
    }, 20);
    timer.unref();
  });
  return { base: `http://127.0.0.1:${port}`, origin, child };
}

test('real HTTP service remains healthy after repeated rejected BYOK requests, with no payment fallback', { timeout: 20000 }, async (t) => {
  const { base, child } = await startServer(t);
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const responses = await Promise.all(['/api/chat', '/api/translate', '/api/language-assist', '/api/model/test'].map((route) => fetch(base + route, { method: 'POST', body: '{}' })));
    for (const response of responses) {
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'model_configuration_required');
    }
    assert.equal((await fetch(base + '/api/health')).status, 200);
  }
  for (const route of ['/api/billing/checkout', '/api/billing/paddle/webhook', '/api/commerce/status', '/api/model']) {
    const response = await fetch(base + route, { method: 'POST', body: '{}' });
    assert.equal(response.status, 410);
    assert.equal((await response.json()).mode, 'free_byok');
  }
  const blockedHeader = encodeURIComponent(JSON.stringify({ baseUrl: 'https://127.0.0.1', model: 'm', apiKey: 'private-user-secret' }));
  assert.equal((await fetch(base + '/api/model/test', { method: 'POST', headers: { 'x-wyth-model': blockedHeader }, body: '{}' })).status, 400);
  for (const pathname of ['/.env.local', '/server.mjs', '/.local-data/model.json', '/src/byok.js', '/package.json']) {
    assert.equal((await fetch(base + pathname)).status, 404, pathname);
  }
  for (const pathname of ['/', '/src/app.js', '/src/byokSession.js', '/src/wythI18n.js', '/styles.css']) {
    assert.equal((await fetch(base + pathname)).status, 200, pathname);
  }
  const readiness = await (await fetch(base + '/api/health/ready')).json();
  assert.equal(readiness.mode, 'free_byok');
  assert.equal(readiness.llm.userConfigurationRequired, true);
  assert.equal(child.exitCode, null);
});

test('BYOK model tests are rate limited without taking down health checks', { timeout: 15000 }, async (t) => {
  const { base } = await startServer(t, { limit: 2 });
  for (let count = 0; count < 2; count += 1) assert.equal((await fetch(base + '/api/model/test', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await fetch(base + '/api/model/test', { method: 'POST', body: '{}' })).status, 429);
  assert.equal((await fetch(base + '/api/health')).status, 200);
});

test('production keeps origin and login checks ahead of every BYOK and legacy billing route', { timeout: 15000 }, async (t) => {
  const { base, origin } = await startServer(t, { production: true });
  for (const route of ['/api/chat', '/api/model/test', '/api/translate', '/api/language-assist', '/api/billing/checkout']) {
    assert.equal((await fetch(base + route, { method: 'POST', body: '{}' })).status, 403);
    const result = await fetch(base + route, { method: 'POST', headers: { origin }, body: '{}' });
    assert.equal(result.status, 401);
    assert.equal((await result.json()).error, 'authentication_required');
  }
  assert.equal((await fetch(base + '/api/health/ready')).status, 200);
});
