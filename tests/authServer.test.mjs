import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthCookies,
  createRecoveryProof,
  createSupabaseAuthClient,
  createVerifiedSessionCache,
  normalizeCredentials,
  parseAuthCookies,
  resolveAuthenticatedUser,
  verifyRecoveryProof
} from '../src/authServer.js';

test('verified session cache avoids repeated provider lookups without storing raw tokens', async () => {
  let now = 1_000;
  let lookups = 0;
  const cache = createVerifiedSessionCache({ now: () => now, ttlMs: 5_000, maxEntries: 10 });
  const authClient = {
    async getUser() {
      lookups += 1;
      return { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' };
    }
  };

  const first = await resolveAuthenticatedUser('wyth_access=sensitive-access-token', authClient, { sessionCache: cache });
  const second = await resolveAuthenticatedUser('wyth_access=sensitive-access-token', authClient, { sessionCache: cache });

  assert.equal(first.user.id, 'user-1');
  assert.equal(second.user.id, 'user-1');
  assert.equal(lookups, 1);
  assert.deepEqual(cache.snapshot(), { size: 1 });
  assert.doesNotMatch(JSON.stringify(cache.snapshot()), /sensitive-access-token/);

  now += 5_001;
  await resolveAuthenticatedUser('wyth_access=sensitive-access-token', authClient, { sessionCache: cache });
  assert.equal(lookups, 2);
});

test('credentials normalize email and reject malformed or weak input', () => {
  assert.deepEqual(normalizeCredentials({ email: '  USER@Example.COM ', password: 'long-enough' }), {
    email: 'user@example.com',
    password: 'long-enough'
  });
  assert.throws(() => normalizeCredentials({ email: 'not-an-email', password: 'long-enough' }), /invalid_email/);
  assert.throws(() => normalizeCredentials({ email: 'user@example.com', password: 'short' }), /invalid_password/);
});

test('private API authentication refreshes an expired cookie and returns safe replacement cookies', async () => {
  const authClient = {
    async getUser(token) {
      if (token === 'expired') throw Object.assign(new Error('expired'), { status: 401 });
      return { id: 'user-1', email: 'u@example.com', email_confirmed_at: '2026-08-12T00:00:00Z' };
    },
    async refresh(token) {
      assert.equal(token, 'refresh-old');
      return { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
    }
  };
  const result = await resolveAuthenticatedUser('wyth_access=expired; wyth_refresh=refresh-old', authClient, { secure: true });
  assert.equal(result.user.id, 'user-1');
  assert.equal(result.cookies.length, 2);
  assert.doesNotMatch(JSON.stringify(result.user), /new-access|new-refresh/);
});

test('private API authentication never rotates refresh tokens for a transient provider outage', async () => {
  let refreshCalls = 0;
  const authClient = {
    async getUser() {
      throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable', status: 503 });
    },
    async refresh() {
      refreshCalls += 1;
      return { access_token: 'should-not-exist', refresh_token: 'should-not-exist', expires_in: 3600 };
    }
  };

  await assert.rejects(
    () => resolveAuthenticatedUser('wyth_access=access; wyth_refresh=refresh', authClient),
    (error) => error.code === 'auth_unavailable' && error.status === 503
  );
  assert.equal(refreshCalls, 0);
});

test('auth cookies are httpOnly, same-site, bounded, and secure in production', () => {
  const headers = createAuthCookies({
    access_token: 'access-value',
    refresh_token: 'refresh-value',
    expires_in: 3600
  }, { secure: true });

  assert.equal(headers.length, 2);
  for (const header of headers) {
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.match(header, /Secure/i);
    assert.match(header, /Path=\//i);
    assert.doesNotMatch(header, /Domain=/i);
  }
  assert.match(headers[0], /Max-Age=3600/i);
  assert.match(headers[1], /Max-Age=2592000/i);
});

test('recovery proof is bound to one access token and server secret', () => {
  const proof = createRecoveryProof('access-one', 'server-secret');
  assert.equal(verifyRecoveryProof(proof, 'access-one', 'server-secret'), true);
  assert.equal(verifyRecoveryProof(proof, 'access-two', 'server-secret'), false);
  assert.equal(verifyRecoveryProof(proof, 'access-one', 'other-secret'), false);
});

test('supabase client verifies only signup and recovery token hashes', async () => {
  const calls = [];
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co', publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }), { status: 200 });
    }
  });
  await client.verifyEmailToken('hash-value', 'signup');
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/verify');
  assert.deepEqual(JSON.parse(calls[0].options.body), { token_hash: 'hash-value', type: 'signup' });
  assert.throws(() => client.verifyEmailToken('hash-value', 'magiclink'), /invalid_code/);
});

test('auth cookie parser ignores unrelated cookies and decodes session values', () => {
  assert.deepEqual(parseAuthCookies('theme=dark; wyth_access=access%20value; wyth_refresh=refresh%2Fvalue'), {
    accessToken: 'access value',
    refreshToken: 'refresh/value'
  });
});

test('supabase auth client sends the publishable key only to the configured project', async () => {
  const calls = [];
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co/',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  await client.signIn({ email: 'user@example.com', password: 'long-enough' });
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'user@example.com', password: 'long-enough' });
});

test('supabase availability check retries safe network failures and returns no provider payload', async () => {
  let attempts = 0;
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    retryDelayMs: 0,
    fetchImpl: async (url, options) => {
      attempts += 1;
      assert.equal(url, 'https://project.supabase.co/auth/v1/settings');
      assert.equal(options.method, 'GET');
      if (attempts === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
      return new Response(JSON.stringify({ external: { email: true } }), { status: 200 });
    }
  });

  assert.deepEqual(await client.checkAvailability(), { ok: true });
  assert.equal(attempts, 2);
});

test('supabase availability check reports a sanitized unavailable error after bounded retries', async () => {
  let attempts = 0;
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    retryDelayMs: 0,
    availabilityAttempts: 3,
    fetchImpl: async () => {
      attempts += 1;
      throw Object.assign(new TypeError('fetch failed with secret detail'), { cause: { code: 'EACCES' } });
    }
  });

  await assert.rejects(() => client.checkAvailability(), (error) => {
    assert.equal(error.code, 'auth_unavailable');
    assert.equal(error.status, 503);
    assert.equal(error.attempts, 3);
    assert.doesNotMatch(error.message, /secret detail/);
    return true;
  });
  assert.equal(attempts, 3);
});

test('supabase auth client refreshes and reads users without exposing provider errors', async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ access_token: 'next', refresh_token: 'refresh-next', expires_in: 3600 }), { status: 200 }),
    new Response(JSON.stringify({ id: 'user-1', email: 'user@example.com' }), { status: 200 }),
    new Response(JSON.stringify({ message: 'provider detail containing sensitive internals' }), { status: 400 })
  ];
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    }
  });

  const session = await client.refresh('refresh-old');
  const user = await client.getUser(session.access_token);
  assert.equal(user.id, 'user-1');
  assert.match(calls[1].options.headers.authorization, /^Bearer next$/);
  await assert.rejects(() => client.signIn({ email: 'user@example.com', password: 'wrong-password' }), (error) => {
    assert.equal(error.code, 'auth_failed');
    assert.equal(error.status, 400);
    assert.doesNotMatch(error.message, /sensitive internals/);
    return true;
  });
});

test('signup and password recovery place allowlisted redirect in the request URL', async () => {
  const calls = [];
  const client = createSupabaseAuthClient({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('{}', { status: 200 });
    }
  });
  const redirect = 'http://127.0.0.1:53128/?auth=confirmed';
  await client.signUp({ email: 'u@example.com', password: 'long-enough' }, redirect);
  await client.requestPasswordReset('u@example.com', 'http://127.0.0.1:53128/?auth=recovery');

  assert.equal(calls[0].url, `https://project.supabase.co/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'u@example.com', password: 'long-enough' });
  assert.match(calls[1].url, /\/auth\/v1\/recover\?redirect_to=/);
  assert.deepEqual(JSON.parse(calls[1].options.body), { email: 'u@example.com' });
});
