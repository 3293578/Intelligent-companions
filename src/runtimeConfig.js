const PLACEHOLDER_PATTERN = /(?:replace[_-]?me|replace[_-]?with|change[_-]?me|your[_-]|example)/i;

function hasRealValue(value, minimumLength = 1) {
  const text = String(value || '').trim();
  return text.length >= minimumLength && !PLACEHOLDER_PATTERN.test(text);
}

function isHttpsOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.origin === String(value).replace(/\/$/, '');
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveServerHost(env = {}) {
  const configured = String(env.HOST || '').trim();
  if (configured) return configured;
  return env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
}

export function assertProductionEnvironment(env = {}) {
  if (env.NODE_ENV !== 'production') return;
  const invalid = [];
  if (!isHttpsOrigin(env.APP_ORIGIN)) invalid.push('APP_ORIGIN');
  if (!isHttpsUrl(env.SUPABASE_URL)) invalid.push('SUPABASE_URL');
  if (!hasRealValue(env.SUPABASE_PUBLISHABLE_KEY, 24)) invalid.push('SUPABASE_PUBLISHABLE_KEY');
  if (!hasRealValue(env.AUTH_RECOVERY_SECRET, 32)) invalid.push('AUTH_RECOVERY_SECRET');
  if (!hasRealValue(env.DEEPSEEK_API_KEY || env.LLM_API_KEY, 16)) invalid.push('DEEPSEEK_API_KEY');
  if (invalid.length) throw new Error(`Invalid production environment: ${invalid.join(', ')}`);
}
