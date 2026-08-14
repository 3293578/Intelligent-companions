function numberOrZero(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function createCircuitBreaker(options = {}) {
  const failureThreshold = Math.max(1, Number(options.failureThreshold) || 3);
  const resetMs = Math.max(1_000, Number(options.resetMs) || 30_000);
  const now = options.now || (() => Date.now());
  let state = 'closed';
  let consecutiveFailures = 0;
  let retryAt = null;

  function snapshot() {
    return { state, consecutiveFailures, retryAt };
  }

  return {
    beforeRequest() {
      if (state === 'closed') return { allowed: true, state };
      if (state === 'half_open') return { allowed: false, state };
      if (now() < retryAt) return { allowed: false, state };
      state = 'half_open';
      return { allowed: true, state };
    },
    recordSuccess() {
      state = 'closed';
      consecutiveFailures = 0;
      retryAt = null;
    },
    recordFailure() {
      consecutiveFailures += 1;
      if (state === 'half_open' || consecutiveFailures >= failureThreshold) {
        state = 'open';
        retryAt = now() + resetMs;
      }
    },
    snapshot
  };
}

export function classifyLlmError(error) {
  if (error?.code === 'CIRCUIT_OPEN') return 'circuit_open';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'timeout';
  if (Number(error?.status) >= 500) return 'provider_5xx';
  if (Number(error?.status) >= 400) return 'provider_4xx';
  if (error?.code || (error instanceof TypeError && error.message === 'fetch failed')) return 'network';
  return 'unknown';
}

export function createSafeLlmDiagnostic(options = {}) {
  const messages = Array.isArray(options.messages) ? options.messages : [];
  return {
    requestId: String(options.requestId || ''),
    category: classifyLlmError(options.error),
    attempts: Math.max(1, numberOrZero(options.error?.attempts) || 1),
    latencyMs: numberOrZero(options.latencyMs),
    model: String(options.model || ''),
    context: {
      messageCount: messages.length,
      characterCount: messages.reduce((total, message) => total + String(message?.content || '').length, 0)
    }
  };
}

function shouldTripCircuit(error) {
  const category = classifyLlmError(error);
  return category === 'network'
    || category === 'timeout'
    || category === 'provider_5xx'
    || Number(error?.status) === 408
    || Number(error?.status) === 409
    || Number(error?.status) === 429;
}

function createCircuitOpenError() {
  const error = new Error('LLM provider is temporarily unavailable.');
  error.code = 'CIRCUIT_OPEN';
  error.retryable = true;
  return error;
}

export function createInstrumentedLlmClient(options = {}) {
  const now = options.now || (() => Date.now());
  const createRequestId = options.createRequestId || (() => crypto.randomUUID());
  return async function instrumentedLlmClient(messages) {
    const gate = options.circuit?.beforeRequest?.() || { allowed: true };
    const requestId = createRequestId();
    const startedAt = now();
    if (!gate.allowed) {
      const error = createCircuitOpenError();
      error.requestId = requestId;
      options.onDiagnostic?.(createSafeLlmDiagnostic({
        requestId,
        error,
        latencyMs: now() - startedAt,
        model: options.model,
        messages
      }));
      throw error;
    }
    try {
      const result = await options.client(messages);
      options.circuit?.recordSuccess?.();
      return result;
    } catch (error) {
      if (shouldTripCircuit(error)) options.circuit?.recordFailure?.();
      error.requestId = requestId;
      options.onDiagnostic?.(createSafeLlmDiagnostic({
        requestId,
        error,
        latencyMs: now() - startedAt,
        model: options.model,
        messages
      }));
      throw error;
    }
  };
}
