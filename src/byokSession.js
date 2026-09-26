export function modelTestErrorKey(error = {}) {
  const code = error.code || error.message;
  if (code === 'authentication_required') return 'model.loginRequired';
  if (code === 'auth_unavailable' || code === 'auth_not_configured') return 'model.authUnavailable';
  if (code === 'email_not_verified') return 'model.emailRequired';
  if (code === 'invalid_model_configuration' || code === 'model_configuration_required' || error instanceof TypeError && /URL/i.test(error.message)) return 'model.invalidConfiguration';
  if (code === 'model_provider_auth') return 'model.providerAuth';
  if (code === 'model_provider_request') return 'model.providerRequest';
  if (code === 'model_provider_limit') return 'model.providerLimit';
  if (error.status === 429) return 'model.rateLimited';
  return 'model.saveFailed';
}

// This module deliberately has no storage API. Reloading or signing out clears the key.
export function createByokSession({ fetchImpl = globalThis.fetch } = {}) {
  let config = null;
  let generation = new AbortController();
  const clear = () => { generation.abort(); generation = new AbortController(); config = null; };
  return {
    clear,
    checkpoint() {
      const current = generation;
      return () => generation === current && !current.signal.aborted;
    },
    summary() {
      if (!config) return { configured: false, provider: 'custom', model: '', baseUrl: '', apiMode: 'chat_completions' };
      const { apiKey, ...safe } = config;
      return { ...safe, provider: 'custom', configured: true };
    },
    configure(input) {
      const previous = config;
      const model = String(input.model || '').trim();
      const url = new URL(String(input.baseUrl || '').trim());
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) throw new Error('invalid_model_configuration');
      url.pathname = url.pathname.replace(/\/(chat\/completions|responses)\/?$/, '').replace(/\/$/, '');
      const baseUrl = url.href.replace(/\/$/, '');
      // An old key must never be silently sent to a newly edited URL.
      const apiKey = String(input.apiKey || '').trim() || (config?.baseUrl === baseUrl ? config.apiKey : '');
      if (!model || model.length > 160 || /[\x00-\x1f\x7f]/.test(model) || !apiKey || apiKey.length > 2048 || /[^\x21-\x7e]/.test(apiKey) || baseUrl.length > 2048) throw new Error('invalid_model_configuration');
      clear();
      config = { model, baseUrl, apiKey, apiMode: input.apiMode === 'responses' ? 'responses' : 'chat_completions' };
      const configuredGeneration = generation;
      return () => {
        // A late failed test must not resurrect credentials after logout/account change,
        // or replace a newer configuration. A rollback can run only once.
        if (generation !== configuredGeneration) return;
        generation.abort();
        generation = new AbortController();
        config = previous;
      };
    },
    async fetch(url, options = {}) {
      if (!['/api/chat', '/api/translate', '/api/language-assist', '/api/model/test'].includes(url)) throw new Error('invalid_model_route');
      if (!config) throw new Error('model_configuration_required');
      return fetchImpl(url, {
        ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { ...options.headers, 'x-wyth-model': encodeURIComponent(JSON.stringify(config)) },
        signal: AbortSignal.any([generation.signal, options.signal || generation.signal, AbortSignal.timeout(50000)])
      });
    }
  };
}
