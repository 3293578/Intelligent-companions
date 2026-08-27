import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_PATTERN = /^pri_[a-z0-9]{26}$/;
const EVENT_PATTERN = /^evt_[a-z0-9]{26}$/;
const SUBSCRIPTION_PATTERN = /^sub_[a-z0-9]{26}$/;
const CUSTOMER_PATTERN = /^ctm_[a-z0-9]{26}$/;
const PLANS = new Set(['standard', 'unlimited']);
const STATUSES = new Set(['trialing', 'active', 'past_due', 'paused', 'canceled']);
const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.paused',
  'subscription.resumed'
]);

function billingError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function requirePattern(value, pattern, code) {
  const normalized = String(value || '').trim();
  if (!pattern.test(normalized)) throw billingError(code);
  return normalized;
}

function isoInstant(value, code) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw billingError(code);
  return date.toISOString();
}

function checkoutOrigin(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw billingError('invalid_checkout_url');
  }
  return url.toString();
}

function verifiedPaddleCheckoutUrl(value) {
  const url = new URL(String(value || ''));
  const paddleHost = url.hostname === 'paddle.com' || url.hostname.endsWith('.paddle.com');
  if (url.protocol !== 'https:' || !paddleHost) throw billingError('invalid_paddle_response', 502);
  return url.toString();
}

export function createPaddleBillingClient(options = {}) {
  const apiKey = String(options.apiKey || '').trim();
  const environment = String(options.environment || 'sandbox').toLowerCase();
  const baseUrl = environment === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';
  const checkoutUrl = checkoutOrigin(options.checkoutUrl);
  const priceIds = {
    standard: requirePattern(options.priceIds?.standard, PRICE_PATTERN, 'invalid_standard_price'),
    unlimited: requirePattern(options.priceIds?.unlimited, PRICE_PATTERN, 'invalid_unlimited_price')
  };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs || 10_000));
  if (apiKey.length < 24 || typeof fetchImpl !== 'function') throw billingError('paddle_not_configured', 503);

  async function createCheckout(input = {}) {
    const userId = requirePattern(input.userId, UUID_PATTERN, 'invalid_user_id');
    const plan = String(input.plan || '').toLowerCase();
    if (!PLANS.has(plan)) throw billingError('invalid_plan');

    let response;
    try {
      response = await fetchImpl(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          items: [{ price_id: priceIds[plan], quantity: 1 }],
          collection_mode: 'automatic',
          custom_data: { wyth_user_id: userId, wyth_plan: plan },
          checkout: { url: checkoutUrl }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw billingError('paddle_unavailable', 503);
    }
    if (!response?.ok) throw billingError('paddle_unavailable', 503);
    const payload = await response.json().catch(() => null);
    const transactionId = String(payload?.data?.id || '');
    if (!/^txn_[a-z0-9]{26}$/.test(transactionId)) {
      throw billingError('invalid_paddle_response', 502);
    }
    const url = verifiedPaddleCheckoutUrl(payload?.data?.checkout?.url);
    return { transactionId, url };
  }

  return { createCheckout };
}

function signatureParts(header) {
  const parts = String(header || '').split(';').map((part) => part.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith('ts='))?.slice(3) || '';
  const signatures = parts.filter((part) => part.startsWith('h1=')).map((part) => part.slice(3));
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) throw billingError('invalid_webhook_signature', 401);
  return { timestamp, signatures };
}

export function verifyPaddleWebhook(options = {}) {
  const rawBody = options.rawBody;
  const secret = String(options.secret || '');
  if (typeof rawBody !== 'string' || secret.length < 12) throw billingError('webhook_not_configured', 503);
  const { timestamp, signatures } = signatureParts(options.signatureHeader);
  const now = options.now || (() => Date.now());
  const toleranceSeconds = Math.max(5, Number(options.toleranceSeconds || 300));
  if (Math.abs(Math.floor(now() / 1000) - Number(timestamp)) > toleranceSeconds) {
    throw billingError('stale_webhook', 401);
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`, 'utf8').digest();
  const valid = signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const received = Buffer.from(candidate, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!valid) throw billingError('invalid_webhook_signature', 401);
  try {
    return JSON.parse(rawBody);
  } catch {
    throw billingError('invalid_webhook_payload');
  }
}

export function normalizePaddleSubscriptionEvent(event = {}) {
  const eventType = String(event.event_type || '');
  if (!SUBSCRIPTION_EVENTS.has(eventType)) return null;
  const data = event.data || {};
  const plan = String(data.custom_data?.wyth_plan || '').toLowerCase();
  const status = String(data.status || '').toLowerCase();
  if (!PLANS.has(plan)) throw billingError('invalid_webhook_plan');
  if (!STATUSES.has(status)) throw billingError('invalid_webhook_status');
  const currentPeriod = data.current_billing_period || {};
  return {
    providerEventId: requirePattern(event.event_id, EVENT_PATTERN, 'invalid_webhook_event_id'),
    eventType,
    occurredAt: isoInstant(event.occurred_at, 'invalid_webhook_time'),
    userId: requirePattern(data.custom_data?.wyth_user_id, UUID_PATTERN, 'invalid_webhook_user'),
    providerCustomerId: data.customer_id
      ? requirePattern(data.customer_id, CUSTOMER_PATTERN, 'invalid_webhook_customer')
      : null,
    providerSubscriptionId: requirePattern(data.id, SUBSCRIPTION_PATTERN, 'invalid_webhook_subscription'),
    plan,
    status,
    currentPeriodStart: isoInstant(currentPeriod.starts_at, 'invalid_webhook_period'),
    currentPeriodEnd: isoInstant(currentPeriod.ends_at, 'invalid_webhook_period'),
    cancelAtPeriodEnd: data.scheduled_change?.action === 'cancel'
  };
}
