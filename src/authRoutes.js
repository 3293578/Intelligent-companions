import {
  createAuthCookies,
  createClearedAuthCookies,
  createClearedRecoveryCookie,
  createRecoveryCookie,
  createRecoveryProof,
  isAuthUnavailableError,
  isRefreshableSessionError,
  verifyRecoveryProof,
  parseAuthCookies
} from './authServer.js';

function response(status, body, cookies = [], headers = {}) {
  return { status, body, cookies, headers };
}

function publicUser(user = {}) {
  return {
    id: String(user.id || ''),
    email: String(user.email || ''),
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at)
  };
}

function safeError(error) {
  if (error?.code === 'invalid_email' || error?.code === 'invalid_password') return response(400, { error: error.code });
  if (isAuthUnavailableError(error)) return response(503, { error: 'auth_unavailable', retryable: true });
  if (error?.status === 429) return response(429, { error: 'too_many_requests' });
  return response(401, { error: 'auth_failed' });
}

export function createFixedWindowRateLimiter(options = {}) {
  const limit = Math.max(1, Number(options.limit) || 10);
  const windowMs = Math.max(1_000, Number(options.windowMs) || 60_000);
  const now = options.now || (() => Date.now());
  const entries = new Map();
  return {
    consume(key) {
      const at = now();
      if (entries.size > 2_000) {
        for (const [entryKey, entry] of entries) {
          if (entry.resetAt <= at) entries.delete(entryKey);
        }
        if (entries.size > 2_000) entries.delete(entries.keys().next().value);
      }
      const current = entries.get(key);
      if (!current || current.resetAt <= at) {
        entries.set(key, { count: 1, resetAt: at + windowMs });
        return { allowed: true, remaining: limit - 1 };
      }
      current.count += 1;
      return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfterMs: current.resetAt - at };
    }
  };
}

export function createAuthRouteHandler(options = {}) {
  const configured = Boolean(options.configured);
  const authClient = options.authClient;
  const appOrigin = new URL(options.appOrigin || 'http://127.0.0.1:5173').origin;
  const secureCookies = options.secureCookies ?? appOrigin.startsWith('https://');
  const limiter = options.limiter || createFixedWindowRateLimiter({ limit: 10, windowMs: 10 * 60_000 });
  const recoverySecret = String(options.recoverySecret || '');
  const statusLookupTimeoutMs = Math.max(1_000, Number(options.statusLookupTimeoutMs) || 5_000);
  const sessionCache = options.sessionCache;

  function mutationAllowed(request) {
    const origin = request.headers?.origin;
    return origin === appOrigin;
  }

  function cookiesFor(session) {
    return createAuthCookies(session, { secure: secureCookies });
  }

  async function sessionUser(session) {
    const user = session?.user?.id ? session.user : await authClient.getUser(session.access_token);
    sessionCache?.set(session.access_token, user, session.expires_in);
    return response(200, { configured: true, state: 'authenticated', user: publicUser(user) }, cookiesFor(session));
  }

  return async function handleAuthRoute(request) {
    const pathname = new URL(request.url, appOrigin).pathname;
    const routes = new Set(['/api/auth/status', '/api/auth/confirm', '/api/auth/signup', '/api/auth/login', '/api/auth/reset', '/api/auth/password', '/api/auth/logout']);
    if (!routes.has(pathname)) return response(404, { error: 'not_found' });
    if (!configured) {
      if (pathname === '/api/auth/status') return response(200, { configured: false, state: 'local' });
      return response(503, { error: 'auth_not_configured' });
    }
    if (request.method !== 'GET' && !mutationAllowed(request)) return response(403, { error: 'invalid_origin' });

    try {
      if (pathname === '/api/auth/confirm' && request.method === 'GET') {
        const url = new URL(request.url, appOrigin);
        const type = url.searchParams.get('type');
        const tokenHash = url.searchParams.get('token_hash');
        try {
          const session = await authClient.verifyEmailToken(tokenHash, type);
          if (session?.user?.id) sessionCache?.set(session.access_token, session.user, session.expires_in);
          const cookies = cookiesFor(session);
          if (type === 'recovery') cookies.push(createRecoveryCookie(createRecoveryProof(session.access_token, recoverySecret), { secure: secureCookies }));
          return response(303, null, cookies, { location: `${appOrigin}/?auth=${type === 'recovery' ? 'recovery' : 'confirmed'}` });
        } catch (error) {
          if (isAuthUnavailableError(error)) {
            return response(303, null, [], { location: `${appOrigin}/?auth=unavailable` });
          }
          return response(303, null, createClearedAuthCookies({ secure: secureCookies }), { location: `${appOrigin}/?auth=expired` });
        }
      }
      if (pathname === '/api/auth/status' && request.method === 'GET') {
        const authCookies = parseAuthCookies(request.headers?.cookie);
        if (!authCookies.accessToken && !authCookies.refreshToken) {
          if (typeof authClient.checkAvailability === 'function') await authClient.checkAvailability();
          return response(200, { configured: true, state: 'signed_out' });
        }
        try {
          const cachedUser = sessionCache?.get(authCookies.accessToken);
          if (cachedUser) return response(200, { configured: true, state: 'authenticated', user: publicUser(cachedUser) });
          const user = await authClient.getUser(authCookies.accessToken, {
            maxAttempts: 1,
            timeoutMs: statusLookupTimeoutMs
          });
          sessionCache?.set(authCookies.accessToken, user);
          return response(200, { configured: true, state: 'authenticated', user: publicUser(user) });
        } catch (error) {
          if (!isRefreshableSessionError(error)) throw error;
          if (!authCookies.refreshToken) return response(200, { configured: true, state: 'expired' }, createClearedAuthCookies({ secure: secureCookies }));
          return sessionUser(await authClient.refresh(authCookies.refreshToken));
        }
      }

      const rateKey = `${request.ip || 'unknown'}:${pathname}`;
      if (!limiter.consume(rateKey).allowed) return response(429, { error: 'too_many_requests' });

      if (pathname === '/api/auth/signup' && request.method === 'POST') {
        await authClient.signUp(request.body, `${appOrigin}/?auth=confirmed`);
        return response(200, { ok: true, verificationRequired: true });
      }
      if (pathname === '/api/auth/login' && request.method === 'POST') {
        const session = await authClient.signIn(request.body);
        const user = session?.user?.id ? session.user : await authClient.getUser(session.access_token);
        sessionCache?.set(session.access_token, user, session.expires_in);
        return response(200, { user: publicUser(user) }, cookiesFor(session));
      }
      if (pathname === '/api/auth/reset' && request.method === 'POST') {
        await authClient.requestPasswordReset(request.body?.email, `${appOrigin}/?auth=recovery`);
        return response(200, { ok: true });
      }
      if (pathname === '/api/auth/password' && request.method === 'POST') {
        const authCookies = parseAuthCookies(request.headers?.cookie);
        if (!authCookies.accessToken) return response(401, { error: 'session_missing' });
        const recoveryProof = String(request.headers?.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('wyth_recovery='))?.slice('wyth_recovery='.length) || '';
        if (!verifyRecoveryProof(decodeURIComponent(recoveryProof), authCookies.accessToken, recoverySecret)) return response(403, { error: 'recovery_required' });
        await authClient.updatePassword(authCookies.accessToken, request.body?.password);
        sessionCache?.delete(authCookies.accessToken);
        return response(200, { ok: true }, [...createClearedAuthCookies({ secure: secureCookies }), createClearedRecoveryCookie({ secure: secureCookies })]);
      }
      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        const authCookies = parseAuthCookies(request.headers?.cookie);
        await authClient.logout(authCookies.accessToken).catch(() => {});
        sessionCache?.delete(authCookies.accessToken);
        return response(200, { ok: true }, [...createClearedAuthCookies({ secure: secureCookies }), createClearedRecoveryCookie({ secure: secureCookies })]);
      }
      return response(404, { error: 'not_found' });
    } catch (error) {
      return safeError(error);
    }
  };
}
