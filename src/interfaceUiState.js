const ROMANTIC_RELATIONSHIPS = new Set(['Girlfriend', 'Boyfriend']);
const RELATIONSHIPS = new Set(['Girlfriend', 'Boyfriend', 'Bestie', 'Mentor', 'Tree hole', 'Knowledge brother']);

export function normalizeRelationshipForAge(value, ageGroup, fallback = 'Bestie') {
  const safeFallback = RELATIONSHIPS.has(fallback) && !ROMANTIC_RELATIONSHIPS.has(fallback)
    ? fallback
    : 'Bestie';
  if (!RELATIONSHIPS.has(value)) return safeFallback;
  if (ageGroup === 'minor' && ROMANTIC_RELATIONSHIPS.has(value)) return safeFallback;
  return value;
}

export function persistInterfaceState(storage, transaction) {
  let previousOnboarding;
  let previousState;
  try {
    previousOnboarding = storage.getItem(transaction.onboardingKey);
    previousState = storage.getItem(transaction.stateKey);
  } catch {
    return { ok: false, errorKey: 'storage.unavailable' };
  }
  try {
    storage.setItem(transaction.onboardingKey, transaction.onboardingValue);
    storage.setItem(transaction.stateKey, transaction.stateValue);
    return { ok: true, error: '' };
  } catch {
    try {
      if (previousOnboarding === null) storage.removeItem?.(transaction.onboardingKey);
      else storage.setItem(transaction.onboardingKey, previousOnboarding);
      if (previousState === null) storage.removeItem?.(transaction.stateKey);
      else storage.setItem(transaction.stateKey, previousState);
    } catch {
      // Best-effort rollback; the caller keeps the previous in-memory state.
    }
    return { ok: false, errorKey: 'storage.unavailable' };
  }
}

export function captureTranscriptView(view) {
  const bottomDistance = Math.max(0, view.scrollHeight - view.scrollTop - view.clientHeight);
  return { atBottom: bottomDistance <= 2, bottomDistance };
}

export function restoreTranscriptView(snapshot, view) {
  if (snapshot.atBottom) return Math.max(0, view.scrollHeight - view.clientHeight);
  return Math.max(0, view.scrollHeight - view.clientHeight - snapshot.bottomDistance);
}
