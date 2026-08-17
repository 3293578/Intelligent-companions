export function createAuthUiState() {
  return {
    configured: false,
    state: 'loading',
    user: null,
    mode: 'login',
    busy: false,
    noticeKey: '',
    errorKey: ''
  };
}

export function parseAuthCallback(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const state = params.get('auth');
  if (state === 'confirmed') return { kind: 'confirmed' };
  if (state === 'recovery') return { kind: 'recovery' };
  if (state === 'expired' || state === 'failed' || state === 'unavailable') return { kind: 'error', errorCode: state };
  return { kind: 'none' };
}

export function authenticatedStatusFromLogin(payload = {}) {
  const user = payload?.user;
  if (!user?.id) return null;
  return { configured: true, state: 'authenticated', user };
}

export function reduceAuthState(current, event = {}) {
  if (event.type === 'STATUS') {
    return {
      ...current,
      configured: Boolean(event.payload?.configured),
      state: event.payload?.state || 'signed_out',
      user: event.payload?.user || null,
      busy: false,
      errorKey: ''
    };
  }
  if (event.type === 'MODE') return { ...current, mode: event.mode, noticeKey: '', errorKey: '' };
  if (event.type === 'BUSY') return { ...current, busy: true, noticeKey: '', errorKey: '' };
  if (event.type === 'SUCCESS') return { ...current, busy: false, noticeKey: event.noticeKey || '', errorKey: '' };
  if (event.type === 'ERROR') return {
    ...current,
    ...(typeof event.configured === 'boolean' ? { configured: event.configured } : {}),
    ...(event.state ? { state: event.state } : {}),
    busy: false,
    noticeKey: '',
    errorKey: event.errorKey || 'auth.error.failed'
  };
  return current;
}
