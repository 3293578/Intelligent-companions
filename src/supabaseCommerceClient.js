import { resolveCommercialAccess } from './entitlements.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATIONS = new Set(['chat', 'translate', 'language_assist', 'content']);

function commerceError(code, status = 503) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function uuid(value, code) {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) throw commerceError(code, 400);
  return normalized;
}

function projectOrigin(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw commerceError('commerce_not_configured');
  }
  return url.origin;
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function isoInstant(value, code = 'invalid_time') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw commerceError(code, 400);
  return date.toISOString();
}

function query(params) {
  return new URLSearchParams(params).toString();
}

export function createSupabaseCommerceClient(options = {}) {
  const origin = projectOrigin(options.supabaseUrl);
  const secretKey = String(options.secretKey || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs || 10_000));
  if (!secretKey.startsWith('sb_secret_') || secretKey.length < 24 || typeof fetchImpl !== 'function') {
    throw commerceError('commerce_not_configured');
  }

  async function request(path, requestOptions = {}) {
    let response;
    try {
      response = await fetchImpl(`${origin}/rest/v1${path}`, {
        method: requestOptions.method || 'GET',
        headers: {
          apikey: secretKey,
          accept: 'application/json',
          ...(requestOptions.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(requestOptions.prefer ? { prefer: requestOptions.prefer } : {})
        },
        ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw commerceError('commerce_unavailable');
    }
    if (!response?.ok) throw commerceError('commerce_unavailable');
    if (response.status === 204) return null;
    return response.json().catch(() => null);
  }

  async function getAccess({ userId, now = new Date().toISOString(), standardAllowanceUsd = 4 } = {}) {
    const user = uuid(userId, 'invalid_user_id');
    const at = isoInstant(now);
    const userFilter = `eq.${user}`;
    const [subscriptions, periods, priorTrials] = await Promise.all([
      request(`/subscriptions?${query({
        select: 'plan,status,current_period_start,current_period_end',
        user_id: userFilter,
        order: 'current_period_end.desc',
        limit: '1'
      })}`),
      request(`/entitlement_periods?${query({
        select: 'kind,starts_at,ends_at,credit_usd',
        user_id: userFilter,
        starts_at: `lte.${at}`,
        ends_at: `gt.${at}`,
        order: 'ends_at.desc'
      })}`),
      request(`/entitlement_periods?${query({
        select: 'id',
        user_id: userFilter,
        kind: 'eq.trial',
        limit: '1'
      })}`)
    ]);

    const subscription = Array.isArray(subscriptions) ? subscriptions[0] : null;
    const activePeriods = Array.isArray(periods) ? periods : [];
    const initial = resolveCommercialAccess({ now: at, periods: activePeriods, subscription, standardAllowanceUsd });
    if (!initial.allowed && initial.reason === 'not_entitled' && Array.isArray(priorTrials) && priorTrials.length === 0) {
      return {
        ...initial,
        allowed: true,
        plan: 'trial_pending',
        reason: 'first_reply_starts_trial'
      };
    }
    if (!initial.allowed && initial.reason === 'not_entitled') return initial;

    const candidateStarts = [
      subscription?.current_period_start,
      ...activePeriods.map((period) => period.starts_at)
    ].filter(Boolean).map((value) => new Date(value)).filter((value) => Number.isFinite(value.getTime()));
    const monthStart = new Date(at);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const usageSince = candidateStarts.length
      ? new Date(Math.max(...candidateStarts.map((date) => date.getTime()))).toISOString()
      : monthStart.toISOString();
    const usageTotal = await request('/rpc/commercial_usage_total', {
      method: 'POST',
      body: { p_user_id: user, p_since: usageSince }
    });
    return resolveCommercialAccess({
      now: at,
      periods: activePeriods,
      subscription,
      usageUsd: finiteNumber(usageTotal),
      standardAllowanceUsd
    });
  }

  async function recordSuccessfulUse(input = {}) {
    const userId = uuid(input.userId, 'invalid_user_id');
    const requestId = uuid(input.requestId, 'invalid_request_id');
    const successfulAt = isoInstant(input.successfulAt);
    const operation = String(input.operation || '');
    if (!OPERATIONS.has(operation)) throw commerceError('invalid_operation', 400);

    if (input.startTrial) {
      await request('/rpc/grant_initial_trial', {
        method: 'POST',
        body: { p_user_id: userId, p_successful_reply_at: successfulAt },
        prefer: 'return=minimal'
      });
    }
    await request('/usage_events', {
      method: 'POST',
      body: {
        user_id: userId,
        request_id: requestId,
        operation,
        provider: String(input.provider || '').slice(0, 40),
        model: String(input.model || '').slice(0, 120),
        input_tokens: Math.floor(finiteNumber(input.inputTokens)),
        output_tokens: Math.floor(finiteNumber(input.outputTokens)),
        estimated_cost_usd: finiteNumber(input.estimatedCostUsd),
        status: 'succeeded',
        created_at: successfulAt
      },
      prefer: 'resolution=ignore-duplicates,return=minimal'
    });
  }

  return { getAccess, recordSuccessfulUse };
}
