export function createWythUiState() {
  return {
    historyReading: false,
    readingMode: 'auto',
    supportPresence: 'none',
    transition: {
      token: 0,
      fromId: '',
      toId: '',
      phase: 'idle',
      direction: 1
    }
  };
}

export function setHistoryReading(state, historyReading) {
  if (state.readingMode === 'scene') return { ...state, historyReading: false };
  if (state.readingMode === 'reading') return { ...state, historyReading: true };
  return { ...state, historyReading: Boolean(historyReading) };
}

export function setReadingMode(state, readingMode) {
  if (!['auto', 'scene', 'reading'].includes(readingMode)) {
    throw new Error(`Invalid reading mode: ${readingMode}`);
  }
  return {
    ...state,
    readingMode,
    historyReading: readingMode === 'reading' ? true : readingMode === 'scene' ? false : state.historyReading
  };
}

export function setSupportPresence(state, presence) {
  const allowed = new Set(['none', 'avatar_close', 'half_body', 'static_companion', 'crisis_static']);
  if (!allowed.has(presence)) throw new Error(`Unknown support presence: ${presence}`);
  return { ...state, supportPresence: presence };
}

export function beginCompanionTransition(state, fromId, toId, direction = 1) {
  return {
    ...state,
    historyReading: state.readingMode === 'reading' ? true : false,
    transition: {
      token: state.transition.token + 1,
      fromId,
      toId,
      phase: 'leaving',
      direction: direction < 0 ? -1 : 1
    }
  };
}

export function completeCompanionTransition(state, token) {
  if (state.transition.token !== token) return state;
  return {
    ...state,
    transition: { ...state.transition, phase: 'idle' }
  };
}

export function resolveMotionPreference(stored, systemReduce) {
  if (stored === 'reduce') return true;
  if (stored === 'full') return false;
  return Boolean(systemReduce);
}
