function tokenCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
}

function rate(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function normalizeProviderUsage(usage = {}) {
  const inputTokens = tokenCount(usage.input_tokens ?? usage.prompt_tokens);
  const cachedInputTokens = Math.min(inputTokens, tokenCount(
    usage.input_tokens_details?.cached_tokens
      ?? usage.prompt_cache_hit_tokens
      ?? usage.prompt_tokens_details?.cached_tokens
  ));
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens: tokenCount(usage.output_tokens ?? usage.completion_tokens)
  };
}

export function estimateModelCost(usage = {}, pricing = {}) {
  const inputTokens = tokenCount(usage.inputTokens);
  const cachedInputTokens = Math.min(inputTokens, tokenCount(usage.cachedInputTokens));
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const outputTokens = tokenCount(usage.outputTokens);
  const cost = (
    uncachedInputTokens * rate(pricing.inputPerMillionUsd, 0.14)
    + cachedInputTokens * rate(pricing.cachedInputPerMillionUsd, 0.0028)
    + outputTokens * rate(pricing.outputPerMillionUsd, 0.28)
  ) / 1_000_000;
  return Number(cost.toFixed(6));
}
