export function createHealthPayload({ startedAt, port, processId } = {}) {
  return {
    ok: true,
    product: 'Wyth',
    port: Number(port),
    startedAt: String(startedAt || ''),
    processId: Number(processId)
  };
}

export function safeProxySummary(value) {
  if (!value) return { configured: false, endpoint: '' };
  try {
    const url = new URL(String(value));
    return { configured: true, endpoint: `${url.protocol}//${url.host}` };
  } catch {
    return { configured: true, endpoint: 'configured' };
  }
}

export function createReadinessPayload({ configured, circuit, provider, model, startedAt, port, processId } = {}) {
  const circuitState = String(circuit?.state || 'closed');
  const base = {
    product: 'Wyth',
    port: Number(port),
    startedAt: String(startedAt || ''),
    processId: Number(processId),
    llm: {
      configured: Boolean(configured),
      circuit: circuitState,
      provider: String(provider || 'deepseek').slice(0, 64),
      model: String(model || '').slice(0, 128)
    }
  };
  if (!configured) {
    return { status: 503, body: { ok: false, reason: 'model_not_configured', ...base } };
  }
  if (circuitState === 'open') {
    return { status: 503, body: { ok: false, reason: 'model_temporarily_unavailable', ...base } };
  }
  return { status: 200, body: { ok: true, ...base } };
}
