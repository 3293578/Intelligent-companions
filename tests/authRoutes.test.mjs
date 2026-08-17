import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthRouteHandler, createFixedWindowRateLimiter } from '../src/authRoutes.js';
import { createRecoveryProof } from '../src/authServer.js';

const origin = 'http://127.0.0.1:53128';

function request(path, options = {}) {
  return {
    method: options.method || 'GET',
    url: `${origin}${path}`,
    headers: { origin, ...(options.headers || {}) },
    body: options.body || {},
    ip: options.ip || '127.0.0.1'
  };
}

test('unconfigured auth stays available as explicit local mode', async () => {
  const handle = createAuthRouteHandler({ configured: false, appOrigin: origin });
  const status = await handle(request('/api/auth/status'));
  assert.deepEqual(status, { status: 200, body: { configured: false, state: 'local' }, cookies: [], headers: {} });
  const login = await handle(request('/api/auth/login', { method: 'POST', body: { email: 'u@example.com', password: 'long-enough' } }));
  assert.equal(login.status, 503);
  assert.equal(login.body.error, 'auth_not_configured');
});

test('signed-out status checks provider availability and reports a retryable outage', async () => {
  let checks = 0;
  const authClient = {
    async checkAvailability() {
      checks += 1;
      throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable', status: 503, attempts: 3 });
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/status'));

  assert.equal(checks, 1);
  assert.deepEqual(result.body, { error: 'auth_unavailable', retryable: true });
  assert.equal(result.status, 503);
});

test('login validates the provider session and returns protected cookies', async () => {
  const authClient = {
    async signIn() { return { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }; },
    async getUser(token) { assert.equal(token, 'access'); return { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' }; }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/login', { method: 'POST', body: { email: 'u@example.com', password: 'long-enough' } }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user, { id: 'user-1', email: 'u@example.com', emailConfirmed: true });
  assert.equal(result.cookies.length, 2);
  assert.match(result.cookies[0], /HttpOnly/);
  assert.doesNotMatch(JSON.stringify(result), /access_token|refresh_token/);
});

test('login reuses the authenticated user returned by Supabase without a redundant lookup', async () => {
  let userLookups = 0;
  const authClient = {
    async signIn() {
      return {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 3600,
        user: { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' }
      };
    },
    async getUser() {
      userLookups += 1;
      throw new Error('redundant user lookup');
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });

  const result = await handle(request('/api/auth/login', {
    method: 'POST', body: { email: 'u@example.com', password: 'long-enough' }
  }));

  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, 'user-1');
  assert.equal(userLookups, 0);
});

test('login seeds and logout clears the verified session cache', async () => {
  const cacheCalls = [];
  const sessionCache = {
    get() { return null; },
    set(token, user, expiresIn) { cacheCalls.push(['set', token, user.id, expiresIn]); },
    delete(token) { cacheCalls.push(['delete', token]); }
  };
  const authClient = {
    async signIn() {
      return {
        access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
        user: { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' }
      };
    },
    async logout() { return {}; }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin, sessionCache });

  await handle(request('/api/auth/login', {
    method: 'POST', body: { email: 'u@example.com', password: 'long-enough' }
  }));
  await handle(request('/api/auth/logout', {
    method: 'POST', headers: { cookie: 'wyth_access=access; wyth_refresh=refresh' }
  }));

  assert.deepEqual(cacheCalls, [
    ['set', 'access', 'user-1', 3600],
    ['delete', 'access']
  ]);
});

test('signup reports verification without revealing whether an account already exists', async () => {
  const calls = [];
  const authClient = {
    async signUp(credentials, redirectTo) {
      calls.push({ credentials, redirectTo });
      return { user: { id: 'user-1', identities: [] }, session: null };
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/signup', { method: 'POST', body: { email: 'u@example.com', password: 'long-enough' } }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, verificationRequired: true });
  assert.equal(calls[0].redirectTo, `${origin}/?auth=confirmed`);
});

test('email confirmation verifies a one-time hash server-side and redirects without tokens', async () => {
  let userLookups = 0;
  const authClient = {
    async verifyEmailToken(hash, type) {
      assert.equal(hash, 'hash-value'); assert.equal(type, 'signup');
      return { access_token: 'confirmed-access', refresh_token: 'confirmed-refresh', expires_in: 3600 };
    },
    async getUser() { userLookups += 1; throw new Error('confirmation must not require a second provider request'); }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/confirm?token_hash=hash-value&type=signup'));
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, `${origin}/?auth=confirmed`);
  assert.equal(result.cookies.length, 2);
  assert.equal(userLookups, 0);
  assert.doesNotMatch(result.headers.location, /token|hash/);
});

test('email confirmation reports a temporary provider outage without calling the link expired', async () => {
  const authClient = {
    async verifyEmailToken() {
      throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable', status: 503 });
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/confirm?token_hash=hash-value&type=signup'));
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, `${origin}/?auth=unavailable`);
  assert.equal(result.cookies.length, 0);
});

test('status refreshes an expired session and never returns token material', async () => {
  const authClient = {
    async getUser(token) {
      if (token === 'expired') throw Object.assign(new Error('auth_failed'), { code: 'auth_failed', status: 401 });
      return { id: 'user-1', email: 'u@example.com' };
    },
    async refresh(token) {
      assert.equal(token, 'refresh-old');
      return { access_token: 'next-access', refresh_token: 'next-refresh', expires_in: 3600 };
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/status', {
    headers: { cookie: 'wyth_access=expired; wyth_refresh=refresh-old' }
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.state, 'authenticated');
  assert.equal(result.cookies.length, 2);
  assert.doesNotMatch(JSON.stringify(result.body), /next-access|next-refresh/);
});

test('status preserves the session during a transient provider outage instead of refreshing it', async () => {
  let refreshCalls = 0;
  const authClient = {
    async getUser() {
      throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable', status: 503 });
    },
    async refresh() {
      refreshCalls += 1;
      return { access_token: 'rotated', refresh_token: 'rotated', expires_in: 3600 };
    }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin });
  const result = await handle(request('/api/auth/status', {
    headers: { cookie: 'wyth_access=access; wyth_refresh=refresh' }
  }));

  assert.equal(refreshCalls, 0);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'auth_unavailable', retryable: true });
  assert.equal(result.cookies.length, 0);
});

test('status uses a single short provider lookup so account confirmation cannot hang the UI', async () => {
  let lookupOptions;
  const authClient = {
    async getUser(_token, options) {
      lookupOptions = options;
      return { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' };
    }
  };
  const handle = createAuthRouteHandler({
    configured: true,
    authClient,
    appOrigin: origin,
    statusLookupTimeoutMs: 4_000
  });

  const result = await handle(request('/api/auth/status', {
    headers: { cookie: 'wyth_access=access; wyth_refresh=refresh' }
  }));

  assert.equal(result.status, 200);
  assert.deepEqual(lookupOptions, { maxAttempts: 1, timeoutMs: 4_000 });
});

test('cookie mutations reject cross-origin requests', async () => {
  const handle = createAuthRouteHandler({ configured: true, authClient: {}, appOrigin: origin });
  const result = await handle(request('/api/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example' } }));
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'invalid_origin');
});

test('cookie mutations reject requests without an origin', async () => {
  const handle = createAuthRouteHandler({ configured: true, authClient: {}, appOrigin: origin });
  const result = await handle({
    method: 'POST',
    url: `${origin}/api/auth/logout`,
    headers: {},
    ip: '127.0.0.1',
    body: {}
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'invalid_origin');
});

test('password update requires a server-bound recovery proof and clears the session', async () => {
  let updated = null;
  const authClient = {
    async updatePassword(token, password) { updated = { token, password }; return {}; }
  };
  const handle = createAuthRouteHandler({ configured: true, authClient, appOrigin: origin, recoverySecret: 'test-secret' });
  const missing = await handle(request('/api/auth/password', { method: 'POST', body: { password: 'new-password' } }));
  assert.equal(missing.status, 401);
  const result = await handle(request('/api/auth/password', {
    method: 'POST',
    headers: { cookie: 'wyth_access=recovery-access; wyth_refresh=recovery-refresh; wyth_recovery=invalid' },
    body: { password: 'new-password' }
  }));
  assert.equal(result.status, 403);
  assert.equal(updated, null);
  const validProof = createRecoveryProof('recovery-access', 'test-secret');
  const valid = await handle(request('/api/auth/password', {
    method: 'POST',
    headers: { cookie: `wyth_access=recovery-access; wyth_refresh=recovery-refresh; wyth_recovery=${validProof}` },
    body: { password: 'new-password' }
  }));
  assert.equal(valid.status, 200);
  assert.deepEqual(updated, { token: 'recovery-access', password: 'new-password' });
  assert.equal(valid.cookies.length, 3);
});

test('auth limiter blocks repeated attempts without retaining request content', () => {
  let now = 1_000;
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });
  assert.equal(limiter.consume('ip:login').allowed, true);
  assert.equal(limiter.consume('ip:login').allowed, true);
  assert.equal(limiter.consume('ip:login').allowed, false);
  now += 60_001;
  assert.equal(limiter.consume('ip:login').allowed, true);
});
