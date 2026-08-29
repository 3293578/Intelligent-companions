const PLACEHOLDER_PATTERN = /(?:replace[_-]?me|replace[_-]?with|change[_-]?me|your[_-]|example)/i;
const PADDLE_PRICE_PATTERN = /^pri_[a-z0-9]{26}$/;
const PADDLE_CLIENT_TOKEN_PATTERN = /^(test|live)_[a-zA-Z0-9]{27}$/;

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
  if (env.COMMERCE_REQUIRED === '1' && !String(env.SUPABASE_SECRET_KEY || '').startsWith('sb_secret_')) {
    invalid.push('SUPABASE_SECRET_KEY');
  }
  if (env.COMMERCE_REQUIRED === '1') {
    const paddleEnvironment = String(env.PADDLE_ENVIRONMENT || '').trim().toLowerCase();
    const clientToken = String(env.PADDLE_CLIENT_TOKEN || '').trim();
    const expectedTokenPrefix = paddleEnvironment === 'sandbox'
      ? 'test_'
      : paddleEnvironment === 'production'
        ? 'live_'
        : '';
    if (!expectedTokenPrefix) invalid.push('PADDLE_ENVIRONMENT');
    if (!hasRealValue(env.PADDLE_API_KEY, 24)) invalid.push('PADDLE_API_KEY');
    if (
      !PADDLE_CLIENT_TOKEN_PATTERN.test(clientToken)
      || !clientToken.startsWith(expectedTokenPrefix)
    ) invalid.push('PADDLE_CLIENT_TOKEN');
    if (!hasRealValue(env.PADDLE_WEBHOOK_SECRET, 12)) invalid.push('PADDLE_WEBHOOK_SECRET');
    if (!PADDLE_PRICE_PATTERN.test(String(env.PADDLE_STANDARD_PRICE_ID || '').trim())) {
      invalid.push('PADDLE_STANDARD_PRICE_ID');
    }
    if (!PADDLE_PRICE_PATTERN.test(String(env.PADDLE_UNLIMITED_PRICE_ID || '').trim())) {
      invalid.push('PADDLE_UNLIMITED_PRICE_ID');
    }
  }
  if (invalid.length) throw new Error(`Invalid production environment: ${invalid.join(', ')}`);
}
