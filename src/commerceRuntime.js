import { estimateModelCost } from './modelUsage.js';

export function createCommerceRuntime(options = {}) {
  const client = options.client || null;
  const required = options.required === true;
  const now = options.now || (() => new Date());
  const standardAllowanceUsd = Number(options.standardAllowanceUsd) || 4;
  const pricing = options.pricing || {};

  return {
    async checkAccess(userId) {
      if (!client) {
        return required
          ? { allowed: false, plan: 'none', reason: 'commerce_unavailable' }
          : { allowed: true, plan: 'staging_bypass', reason: 'commerce_not_enabled' };
      }
      return client.getAccess({
        userId,
        now: now().toISOString(),
        standardAllowanceUsd
      });
    },

    async recordSuccessfulUse(input = {}) {
      if (!client) return;
      await client.recordSuccessfulUse({
        userId: input.userId,
        requestId: input.requestId,
        successfulAt: now().toISOString(),
        operation: input.operation,
        provider: input.provider,
        model: input.model,
        inputTokens: input.usage?.inputTokens,
        outputTokens: input.usage?.outputTokens,
        estimatedCostUsd: estimateModelCost(input.usage, pricing),
        startTrial: input.access?.plan === 'trial_pending'
      });
    }
  };
}
