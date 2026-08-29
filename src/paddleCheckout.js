const PADDLE_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const CLIENT_TOKEN_PATTERN = /^(test|live)_[a-zA-Z0-9]{27}$/;
const TRANSACTION_PATTERN = /^txn_[a-z0-9]{26}$/;

function checkoutError(code) {
  return Object.assign(new Error(code), { code });
}

export function publicPaddleClientConfig(input = {}) {
  const environment = String(input.environment || '').trim().toLowerCase();
  const token = String(input.token || '').trim();
  const expectedPrefix = environment === 'sandbox'
    ? 'test_'
    : environment === 'production'
      ? 'live_'
      : '';
  if (!expectedPrefix || !CLIENT_TOKEN_PATTERN.test(token) || !token.startsWith(expectedPrefix)) return null;
  return { environment, token };
}

function loadPaddleScript(src = PADDLE_SCRIPT_URL) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(checkoutError('paddle_unavailable'));
  }
  if (window.Paddle) return Promise.resolve(window.Paddle);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => reject(checkoutError('paddle_unavailable')), 10_000);
    script.addEventListener('load', () => {
      window.clearTimeout(timeout);
      if (window.Paddle) resolve(window.Paddle);
      else reject(checkoutError('paddle_unavailable'));
    }, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(checkoutError('paddle_unavailable'));
    }, { once: true });
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.append(script);
    }
  });
}

function checkoutLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function createPaddleCheckoutLauncher(options = {}) {
  const loadPaddle = options.loadPaddle || loadPaddleScript;
  let initialized = null;
  let initializedConfigKey = '';

  async function initialize(config) {
    const safeConfig = publicPaddleClientConfig(config);
    if (!safeConfig) throw checkoutError('paddle_not_configured');
    const configKey = `${safeConfig.environment}:${safeConfig.token}`;
    if (initialized && initializedConfigKey !== configKey) throw checkoutError('paddle_config_changed');
    if (!initialized) {
      initializedConfigKey = configKey;
      initialized = (async () => {
        const paddle = await loadPaddle(PADDLE_SCRIPT_URL);
        if (!paddle?.Checkout?.open || typeof paddle.Initialize !== 'function') {
          throw checkoutError('paddle_unavailable');
        }
        if (safeConfig.environment === 'sandbox') paddle.Environment?.set?.('sandbox');
        paddle.Initialize({ token: safeConfig.token });
        return paddle;
      })().catch((error) => {
        initialized = null;
        initializedConfigKey = '';
        throw error;
      });
    }
    return initialized;
  }

  return {
    async open(input = {}) {
      const transactionId = String(input.transactionId || '').trim();
      if (!TRANSACTION_PATTERN.test(transactionId)) throw checkoutError('invalid_transaction');
      const paddle = await initialize(input.config);
      paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: checkoutLocale(input.locale)
        }
      });
    }
  };
}
