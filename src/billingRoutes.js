import { normalizePaddleSubscriptionEvent, verifyPaddleWebhook } from './paddleBilling.js';

function response(status, body) {
  return { status, body };
}

function createCheckoutLimiter(options = {}) {
  const limit = Math.max(1, Number(options.limit || 5));
  const windowMs = Math.max(1_000, Number(options.windowMs || 10 * 60_000));
  const now = options.now || (() => Date.now());
  const entries = new Map();
  return {
    consume(key) {
      const at = now();
      const current = entries.get(key);
      if (!current || current.resetAt <= at) {
        entries.set(key, { count: 1, resetAt: at + windowMs });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    }
  };
}

export function createBillingRouteHandler(options = {}) {
  const billingClient = options.billingClient || null;
  const commerceClient = options.commerceClient || null;
  const webhookSecret = String(options.webhookSecret || '');
  const now = options.now || (() => Date.now());
  const onDiagnostic = options.onDiagnostic || (() => {});
  const checkoutLimiter = options.checkoutLimiter || createCheckoutLimiter({ now });
  const configured = Boolean(billingClient && commerceClient && webhookSecret.length >= 12);

  return {
    configured,

    async checkout(request = {}) {
      if (!configured) return response(503, { error: 'billing_not_configured', retryable: true });
      const userId = String(request.authenticatedUser?.id || '');
      if (!userId) return response(401, { error: 'authentication_required' });
      if (!checkoutLimiter.consume(userId)) return response(429, { error: 'too_many_requests' });
      try {
        const checkout = await billingClient.createCheckout({
          userId,
          plan: request.body?.plan
        });
        return response(200, { transactionId: checkout.transactionId });
      } catch (error) {
        if (error?.code === 'invalid_plan') return response(400, { error: 'invalid_plan' });
        try {
          onDiagnostic({
            category: 'checkout',
            providerStatus: Number.isInteger(error?.providerStatus) ? error.providerStatus : null,
            providerCode: /^[a-z0-9_]{1,100}$/.test(error?.providerCode || '') ? error.providerCode : 'unknown'
          });
        } catch {
          // Diagnostics must never change the client-facing checkout failure.
        }
        return response(503, { error: 'billing_unavailable', retryable: true });
      }
    },

    async webhook(request = {}) {
      if (!configured) return response(503, { error: 'billing_not_configured', retryable: true });
      let event;
      try {
        event = verifyPaddleWebhook({
          rawBody: request.rawBody,
          signatureHeader: request.signatureHeader,
          secret: webhookSecret,
          now
        });
      } catch (error) {
        if (error?.status === 401) return response(401, { error: 'invalid_webhook' });
        return response(error?.status === 503 ? 503 : 400, { error: 'invalid_webhook' });
      }
      try {
        const normalized = normalizePaddleSubscriptionEvent(event);
        if (!normalized) return response(200, { ok: true, ignored: true });
        const applied = await commerceClient.applyPaddleSubscriptionEvent(normalized);
        return response(200, { ok: true, applied: Boolean(applied) });
      } catch {
        return response(503, { error: 'billing_sync_unavailable', retryable: true });
      }
    }
  };
}
