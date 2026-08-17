import { isIP } from 'node:net';

const METERED_PATHS = new Set(['/api/chat', '/api/translate', '/api/language-assist', '/api/content']);

export function isMeteredApiPath(pathname = '') {
  return METERED_PATHS.has(String(pathname));
}

export function clientIpFromRequest(request, { trustProxy = false } = {}) {
  const remote = String(request?.socket?.remoteAddress || 'unknown');
  if (!trustProxy) return remote;
  const forwarded = String(request?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return isIP(forwarded) ? forwarded : remote;
}

function createWindowStore({ limit, windowMs, now }) {
  const entries = new Map();
  function cleanup(at) {
    if (entries.size <= 5_000) return;
    for (const [key, entry] of entries) {
      if (entry.resetAt <= at) entries.delete(key);
    }
    while (entries.size > 5_000) entries.delete(entries.keys().next().value);
  }
  return {
    inspect(key) {
      const at = now();
      cleanup(at);
      const entry = entries.get(key);
      if (!entry || entry.resetAt <= at) return { allowed: true, retryAfterMs: 0 };
      return { allowed: entry.count < limit, retryAfterMs: Math.max(1, entry.resetAt - at) };
    },
    increment(key) {
      const at = now();
      const entry = entries.get(key);
      if (!entry || entry.resetAt <= at) entries.set(key, { count: 1, resetAt: at + windowMs });
      else entry.count += 1;
    }
  };
}

export function createApiUsageLimiter(options = {}) {
  const now = options.now || (() => Date.now());
  const userMinute = createWindowStore({ limit: Math.max(1, Number(options.userMinuteLimit) || 20), windowMs: 60_000, now });
  const ipMinute = createWindowStore({ limit: Math.max(1, Number(options.ipMinuteLimit) || 60), windowMs: 60_000, now });
  const userDaily = createWindowStore({ limit: Math.max(1, Number(options.userDailyLimit) || 300), windowMs: 24 * 60 * 60_000, now });
  return {
    consume({ userId, ip }) {
      const user = String(userId || '');
      const clientIp = String(ip || 'unknown');
      if (!user) return { allowed: false, reason: 'identity_required', retryAfterMs: 0 };
      const checks = [
        ['user_rate', userMinute.inspect(user)],
        ['ip_rate', ipMinute.inspect(clientIp)],
        ['daily_limit', userDaily.inspect(user)]
      ];
      const blocked = checks.find(([, result]) => !result.allowed);
      if (blocked) return { allowed: false, reason: blocked[0], retryAfterMs: blocked[1].retryAfterMs };
      userMinute.increment(user);
      ipMinute.increment(clientIp);
      userDaily.increment(user);
      return { allowed: true, reason: '', retryAfterMs: 0 };
    }
  };
}
