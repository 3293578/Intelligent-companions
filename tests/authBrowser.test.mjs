import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authenticatedStatusFromLogin,
  createAuthUiState,
  parseAuthCallback,
  reduceAuthState
} from '../src/authBrowser.js';

test('auth UI begins in a non-blocking loading state', () => {
  assert.deepEqual(createAuthUiState(), {
    configured: false,
    state: 'loading',
    user: null,
    mode: 'login',
    busy: false,
    noticeKey: '',
    errorKey: ''
  });
});

test('auth callback accepts only safe server-return states and rejects URL tokens', () => {
  assert.deepEqual(parseAuthCallback('?auth=confirmed'), { kind: 'confirmed' });
  assert.deepEqual(parseAuthCallback('?auth=recovery'), { kind: 'recovery' });
  assert.deepEqual(parseAuthCallback('?auth=expired'), { kind: 'error', errorCode: 'expired' });
  assert.deepEqual(parseAuthCallback('?auth=unavailable'), { kind: 'error', errorCode: 'unavailable' });
  assert.deepEqual(parseAuthCallback('#access_token=access&refresh_token=refresh'), { kind: 'none' });
});

test('auth reducer preserves no passwords or tokens and maps stable UI states', () => {
  let state = reduceAuthState(createAuthUiState(), { type: 'STATUS', payload: { configured: true, state: 'signed_out' } });
  state = reduceAuthState(state, { type: 'MODE', mode: 'signup' });
  state = reduceAuthState(state, { type: 'BUSY' });
  state = reduceAuthState(state, { type: 'SUCCESS', noticeKey: 'auth.notice.checkEmail' });
  assert.equal(state.mode, 'signup');
  assert.equal(state.busy, false);
  assert.equal(state.noticeKey, 'auth.notice.checkEmail');
  assert.doesNotMatch(JSON.stringify(state), /password|access_token|refresh_token/);
});

test('auth reducer exposes authenticated user and generic failures', () => {
  const authenticated = reduceAuthState(createAuthUiState(), {
    type: 'STATUS', payload: { configured: true, state: 'authenticated', user: { id: 'u1', email: 'u@example.com' } }
  });
  assert.equal(authenticated.user.email, 'u@example.com');
  const failed = reduceAuthState(authenticated, { type: 'ERROR', errorKey: 'auth.error.failed' });
  assert.equal(failed.errorKey, 'auth.error.failed');
  assert.equal(failed.busy, false);
});

test('a provider outage exits the initial loading state while preserving retryable login UI', () => {
  const unavailable = reduceAuthState(createAuthUiState(), {
    type: 'ERROR',
    errorKey: 'auth.error.unavailable',
    configured: true,
    state: 'signed_out'
  });
  assert.equal(unavailable.configured, true);
  assert.equal(unavailable.state, 'signed_out');
  assert.equal(unavailable.errorKey, 'auth.error.unavailable');
  assert.equal(unavailable.busy, false);
});

test('a successful login response becomes authenticated UI state without a second status lookup', () => {
  assert.deepEqual(authenticatedStatusFromLogin({
    user: { id: 'user-1', email: 'u@example.com', emailConfirmed: true },
    access_token: 'must-not-be-copied'
  }), {
    configured: true,
    state: 'authenticated',
    user: { id: 'user-1', email: 'u@example.com', emailConfirmed: true }
  });
  assert.equal(authenticatedStatusFromLogin({}), null);
});
