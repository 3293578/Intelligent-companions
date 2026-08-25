function authUnavailableError() {
  return Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable' });
}

export function withAuthDeadline(operation, options = {}) {
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || 9_000);
  const setTimer = options.setTimer || globalThis.setTimeout;
  const clearTimer = options.clearTimer || globalThis.clearTimeout;
  const onTimeout = options.onTimeout || (() => {});

  return new Promise((resolve, reject) => {
    let settled = false;
    let timerId;
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimer(timerId);
      handler(value);
    };

    timerId = setTimer(() => {
      if (settled) return;
      settled = true;
      try { onTimeout(); } catch {}
      reject(authUnavailableError());
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then(
        (value) => settle(resolve, value),
        (error) => settle(reject, error)
      );
  });
}
