const DAY_MS = 24 * 60 * 60 * 1_000;
const ACCESS_KINDS = new Set(['trial', 'referral', 'grace', 'support', 'standard', 'unlimited']);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const PRIORITY = ['unlimited', 'standard', 'support', 'referral', 'trial', 'grace'];

function instant(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function nonNegativeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizedPeriod(period = {}, nowMs) {
  const kind = String(period.kind || '').toLowerCase();
  const startsAt = instant(period.startsAt ?? period.starts_at);
  const endsAt = instant(period.endsAt ?? period.ends_at);
  if (!ACCESS_KINDS.has(kind) || !startsAt || !endsAt) return null;
  if (startsAt.getTime() > nowMs || endsAt.getTime() <= nowMs || endsAt <= startsAt) return null;
  return { kind, startsAt, endsAt };
}

function activeSubscriptionPeriod(subscription = {}, nowMs) {
  const plan = String(subscription.plan || '').toLowerCase();
  const status = String(subscription.status || '').toLowerCase();
  const endsAt = instant(subscription.currentPeriodEnd ?? subscription.current_period_end);
  if (!['standard', 'unlimited'].includes(plan) || !ACTIVE_SUBSCRIPTION_STATUSES.has(status) || !endsAt) return null;
  if (endsAt.getTime() <= nowMs) return null;
  return { kind: plan, startsAt: new Date(nowMs), endsAt };
}

export function createTrialGrant(input = {}) {
  const userId = String(input.userId || '').trim();
  const startsAt = instant(input.firstSuccessfulReplyAt);
  if (!userId || !startsAt || input.existingTrial) return null;
  return {
    userId,
    kind: 'trial',
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + DAY_MS).toISOString(),
    sourceType: 'first_successful_ai_reply'
  };
}

export function resolveCommercialAccess(input = {}) {
  const now = instant(input.now) || new Date();
  const nowMs = now.getTime();
  const periods = (Array.isArray(input.periods) ? input.periods : [])
    .map((period) => normalizedPeriod(period, nowMs))
    .filter(Boolean);
  const subscription = activeSubscriptionPeriod(input.subscription, nowMs);
  if (subscription) periods.push(subscription);

  const selectedKind = PRIORITY.find((kind) => periods.some((period) => period.kind === kind));
  if (!selectedKind) {
    return {
      allowed: false,
      plan: 'none',
      reason: 'not_entitled',
      expiresAt: null,
      allowanceUsd: 0,
      usedUsd: nonNegativeNumber(input.usageUsd),
      remainingUsd: 0
    };
  }

  const expiresAt = periods
    .filter((period) => period.kind === selectedKind)
    .reduce((latest, period) => period.endsAt > latest ? period.endsAt : latest, new Date(0))
    .toISOString();
  const usedUsd = nonNegativeNumber(input.usageUsd);
  if (selectedKind === 'unlimited') {
    return {
      allowed: !input.fairUseBlocked,
      plan: selectedKind,
      reason: input.fairUseBlocked ? 'fair_use_review' : 'active_entitlement',
      expiresAt,
      allowanceUsd: null,
      usedUsd,
      remainingUsd: null
    };
  }

  const baseAllowance = nonNegativeNumber(input.standardAllowanceUsd, 2);
  const topUpAllowance = (Array.isArray(input.periods) ? input.periods : [])
    .filter((period) => String(period.kind || '').toLowerCase() === 'top_up')
    .filter((period) => {
      const startsAt = instant(period.startsAt ?? period.starts_at);
      const endsAt = instant(period.endsAt ?? period.ends_at);
      return startsAt && endsAt && startsAt.getTime() <= nowMs && endsAt.getTime() > nowMs;
    })
    .reduce((total, period) => total + nonNegativeNumber(period.creditUsd ?? period.credit_usd), 0);
  const allowanceUsd = baseAllowance + topUpAllowance;
  const remainingUsd = Math.max(0, allowanceUsd - usedUsd);
  return {
    allowed: remainingUsd > 0,
    plan: selectedKind,
    reason: remainingUsd > 0 ? 'active_entitlement' : 'allowance_exhausted',
    expiresAt,
    allowanceUsd,
    usedUsd,
    remainingUsd
  };
}
