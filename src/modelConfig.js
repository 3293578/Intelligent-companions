const MODEL_PROVIDER_PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    defaultModel: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
    apiMode: 'chat_completions',
    keyEnv: 'DEEPSEEK_API_KEY'
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiMode: 'responses',
    keyEnv: 'OPENAI_API_KEY'
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    defaultModel: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
    apiMode: 'chat_completions',
    keyEnv: 'LLM_API_KEY'
  }
};

function cleanBaseUrl(value, fallback) {
  return String(value || fallback || '').replace(/\/+$/, '');
}

export function normalizeModelSelection(input = {}) {
  const provider = Object.hasOwn(MODEL_PROVIDER_PRESETS, input.provider)
    ? input.provider
    : 'deepseek';
  const preset = MODEL_PROVIDER_PRESETS[provider];
  const apiMode = ['chat_completions', 'responses'].includes(input.apiMode)
    ? input.apiMode
    : preset.apiMode;

  return {
    provider,
    model: String(input.model || preset.defaultModel).trim() || preset.defaultModel,
    baseUrl: cleanBaseUrl(input.baseUrl, preset.baseUrl),
    apiMode
  };
}

export function apiKeyForSelection(selection, env = process.env) {
  const preset = MODEL_PROVIDER_PRESETS[selection.provider] || MODEL_PROVIDER_PRESETS.deepseek;
  if (selection.provider === 'openai_compatible') {
    return env.LLM_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || '';
  }
  return env[preset.keyEnv] || '';
}

export function publicModelConfig(selection, env = process.env) {
  const normalized = normalizeModelSelection(selection);
  const preset = MODEL_PROVIDER_PRESETS[normalized.provider];
  return {
    ...normalized,
    label: preset.label,
    keyEnv: preset.keyEnv,
    configured: Boolean(apiKeyForSelection(normalized, env))
  };
}

export { MODEL_PROVIDER_PRESETS };
