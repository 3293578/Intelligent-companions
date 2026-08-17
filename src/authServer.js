const ACCESS_COOKIE = 'wyth_access';
const REFRESH_COOKIE = 'wyth_refresh';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function createVerifiedSessionCache(options = {}) {
  const now = options.now || (() => Date.now());
  const ttlMs = Math.max(1_000, Number(options.ttlMs) || 5 * 60_000);
  const maxEntries = Math.max(10, Number(options.maxEntries) || 2_000);
  const entries = new Map();
  const tokenKey = (token) => createHash('sha256').update(String(token || '')).digest('base64url');

  function removeExpired(at) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= at) entries.delete(key);
    }
  }

  return {
    get(token) {
      if (!token) return null;
      const key = tokenKey(token);
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.user;
    },
    set(token, user, expiresInSeconds) {
      if (!token || !user?.id) return false;
      const at = now();
      removeExpired(at);
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      const providerTtlMs = Number(expiresInSeconds) > 0 ? Number(expiresInSeconds) * 1_000 : ttlMs;
      entries.set(tokenKey(token), { user, expiresAt: at + Math.min(ttlMs, providerTtlMs) });
      return true;
    },
    delete(token) {
      if (!token) return false;
      return entries.delete(tokenKey(token));
    },
    snapshot() {
      removeExpired(now());
      return { size: entries.size };
    }
  };
}

function authError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function safeProviderError(response, payload = {}) {
  const providerCode = String(payload.code || payload.error_code || payload.error || '').toLowerCase();
  if (response.status >= 500) return authError('auth_unavailable', 503);
  if (response.status === 429 || providerCode.includes('rate_limit')) {
    return authError('too_many_requests', 429);
  }
  if (providerCode === 'invalid_credentials') return authError('invalid_credentials', 401);
  if (providerCode === 'email_not_confirmed') return authError('email_not_confirmed', 403);
  return authError('auth_failed', response.status);
}

export function normalizeCredentials(input = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw authError('invalid_email');
  if (password.length < 8 || password.length > 128) throw authError('invalid_password');
  return { email, password };
}

function cookie(name, value, maxAge, { secure = false } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(String(value || ''))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(Number(maxAge) || 0))}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function createAuthCookies(session = {}, options = {}) {
  const accessMaxAge = Math.min(3_600, Math.max(60, Number(session.expires_in) || 3_600));
  return [
    cookie(ACCESS_COOKIE, session.access_token, accessMaxAge, options),
    cookie(REFRESH_COOKIE, session.refresh_token, 30 * 24 * 60 * 60, options)
  ];
}

export function createClearedAuthCookies(options = {}) {
  return [cookie(ACCESS_COOKIE, '', 0, options), cookie(REFRESH_COOKIE, '', 0, options)];
}

function recoverySignature(accessToken, secret) {
  return createHmac('sha256', secret).update(`wyth-recovery:${accessToken}`).digest('base64url');
}

export function createRecoveryProof(accessToken, secret) {
  if (!accessToken || !secret) return '';
  return recoverySignature(String(accessToken), String(secret));
}

export function verifyRecoveryProof(proof, accessToken, secret) {
  if (!proof || !accessToken || !secret) return false;
  const expected = recoverySignature(String(accessToken), String(secret));
  const actualBuffer = Buffer.from(String(proof));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createRecoveryCookie(proof, options = {}) {
  return cookie('wyth_recovery', proof, 15 * 60, options);
}

export function createClearedRecoveryCookie(options = {}) {
  return cookie('wyth_recovery', '', 0, options);
}

export function parseAuthCookies(header = '') {
  const values = Object.fromEntries(String(header).split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    try {
      return [key, decodeURIComponent(raw)];
    } catch {
      return [key, ''];
    }
  }));
  return {
    accessToken: values[ACCESS_COOKIE] || '',
    refreshToken: values[REFRESH_COOKIE] || ''
  };
}

export function isRefreshableSessionError(error) {
  const status = Number(error?.status);
  return status === 401 || status === 403;
}

export function isAuthUnavailableError(error) {
  return error?.code === 'auth_unavailable' || Number(error?.status) >= 500;
}

export async function resolveAuthenticatedUser(cookieHeader, authClient, options = {}) {
  const authCookies = parseAuthCookies(cookieHeader);
  const sessionCache = options.sessionCache;
  if (!authCookies.accessToken && !authCookies.refreshToken) throw authError('session_missing', 401);
  const cachedUser = sessionCache?.get(authCookies.accessToken);
  if (cachedUser) return { user: cachedUser, cookies: [] };
  try {
    const user = await authClient.getUser(authCookies.accessToken);
    sessionCache?.set(authCookies.accessToken, user);
    return { user, cookies: [] };
  } catch (error) {
    if (!isRefreshableSessionError(error)) throw error;
    if (!authCookies.refreshToken) throw authError('session_expired', 401);
    const session = await authClient.refresh(authCookies.refreshToken);
    const user = await authClient.getUser(session.access_token);
    sessionCache?.delete(authCookies.accessToken);
    sessionCache?.set(session.access_token, user, session.expires_in);
    return { user, cookies: createAuthCookies(session, options) };
  }
}

function normalizedProjectUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw authError('auth_not_configured', 503);
  }
  return url.origin;
}

export function createSupabaseAuthClient(options = {}) {
  const projectUrl = normalizedProjectUrl(options.supabaseUrl);
  const publishableKey = String(options.publishableKey || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? 150));
  const availabilityAttempts = Math.max(1, Math.min(5, Number(options.availabilityAttempts || 2)));
  const requestTimeoutMs = Math.max(1_000, Number(options.requestTimeoutMs || 15_000));
  const availabilityTimeoutMs = Math.max(1_000, Number(options.availabilityTimeoutMs || 5_000));
  if (!publishableKey) throw authError('auth_not_configured', 503);

  function waitBeforeRetry(attempt) {
    if (retryDelayMs <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }

  async function request(path, { method = 'POST', body, accessToken, maxAttempts = 1, availabilityProbe = false, timeoutMs = requestTimeoutMs } = {}) {
    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await fetchImpl(`${projectUrl}/auth/v1${path}`, {
          method,
          headers: {
            apikey: publishableKey,
            'content-type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch {
        if (attempt < maxAttempts) {
          await waitBeforeRetry(attempt);
          continue;
        }
        const unavailable = authError('auth_unavailable', 503);
        unavailable.attempts = attempt;
        throw unavailable;
      }
      if (availabilityProbe && (response.status === 408 || response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        await response.arrayBuffer().catch(() => {});
        await waitBeforeRetry(attempt);
        continue;
      }
      break;
    }
    const payload = await response.json().catch(() => ({}));
    if (availabilityProbe && (response.status === 408 || response.status === 429 || response.status >= 500)) {
      const unavailable = authError('auth_unavailable', 503);
      unavailable.attempts = maxAttempts;
      throw unavailable;
    }
    if (!response.ok) throw safeProviderError(response, payload);
    return payload;
  }

  return {
    async checkAvailability() {
      await request('/settings', { method: 'GET', maxAttempts: availabilityAttempts, availabilityProbe: true, timeoutMs: availabilityTimeoutMs });
      return { ok: true };
    },
    signUp(credentials, redirectTo) {
      const suffix = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
      return request(`/signup${suffix}`, { body: normalizeCredentials(credentials) });
    },
    signIn(credentials) {
      return request('/token?grant_type=password', { body: normalizeCredentials(credentials) });
    },
    refresh(refreshToken) {
      if (!refreshToken) throw authError('session_missing', 401);
      return request('/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } });
    },
    getUser(accessToken, requestOptions = {}) {
      if (!accessToken) throw authError('session_missing', 401);
      return request('/user', {
        method: 'GET',
        accessToken,
        maxAttempts: requestOptions.maxAttempts ?? 2,
        timeoutMs: requestOptions.timeoutMs ?? requestTimeoutMs
      });
    },
    requestPasswordReset(email, redirectTo) {
      const normalized = normalizeCredentials({ email, password: 'validation-only' }).email;
      const suffix = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
      return request(`/recover${suffix}`, { body: { email: normalized } });
    },
    updatePassword(accessToken, password) {
      const normalized = normalizeCredentials({ email: 'session@wyth.invalid', password });
      return request('/user', { method: 'PUT', accessToken, body: { password: normalized.password } });
    },
    verifyEmailToken(tokenHash, type) {
      if (!['signup', 'recovery'].includes(type) || !tokenHash || String(tokenHash).length > 2_048) throw authError('invalid_code');
      return request('/verify', { body: { token_hash: String(tokenHash), type } });
    },
    exchangeCode(code) {
      if (!code || String(code).length > 2_048) throw authError('invalid_code');
      return request('/token?grant_type=pkce', { body: { auth_code: String(code) } });
    },
    logout(accessToken) {
      if (!accessToken) return Promise.resolve({});
      return request('/logout', { accessToken });
    }
  };
}
