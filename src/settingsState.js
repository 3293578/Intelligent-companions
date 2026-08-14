import { normalizeLocale } from './wythI18n.js';

export const FULL_SETTINGS_SECTIONS = Object.freeze([
  'account',
  'companionship',
  'characters',
  'language',
  'privacy'
]);

const PROACTIVE_VALUES = new Set(['off', 'rarely', 'sometimes', 'daily']);
const READING_VALUES = new Set(['auto', 'scene', 'reading']);

export function createSettingsState(initial = {}) {
  return {
    surface: 'closed',
    activeSection: 'account',
    returnSurface: 'closed',
    quick: {
      interfaceLocale: normalizeLocale(initial.interfaceLocale),
      proactiveContact: PROACTIVE_VALUES.has(initial.proactiveContact) ? initial.proactiveContact : 'sometimes',
      reduceMotion: Boolean(initial.reduceMotion),
      readingMode: READING_VALUES.has(initial.readingMode) ? initial.readingMode : 'auto',
      soundEnabled: initial.soundEnabled !== false
    }
  };
}

export function openQuickSettings(state) {
  return { ...state, surface: 'quick', returnSurface: 'closed' };
}

export function openFullSettings(state, section = state.activeSection) {
  assertSection(section);
  return {
    ...state,
    surface: 'full',
    activeSection: section,
    returnSurface: state.surface === 'quick' ? 'quick' : 'closed'
  };
}

export function closeSettings(state) {
  if (state.surface === 'full') {
    return { ...state, surface: state.returnSurface, returnSurface: 'closed' };
  }
  return { ...state, surface: 'closed', returnSurface: 'closed' };
}

export function selectFullSettingsSection(state, section) {
  assertSection(section);
  return { ...state, activeSection: section };
}

export function updateQuickSetting(state, key, value) {
  if (!Object.hasOwn(state.quick, key)) throw new Error(`Unknown quick setting: ${key}`);
  let normalized = value;
  if (key === 'interfaceLocale') normalized = normalizeLocale(value);
  if (key === 'proactiveContact') {
    if (!PROACTIVE_VALUES.has(value)) throw new Error(`Invalid proactive contact: ${value}`);
  }
  if (key === 'readingMode') {
    if (!READING_VALUES.has(value)) throw new Error(`Invalid reading mode: ${value}`);
  }
  if (key === 'reduceMotion' || key === 'soundEnabled') normalized = Boolean(value);
  return { ...state, quick: { ...state.quick, [key]: normalized } };
}

export function persistQuickSettings(storage, key, currentState, nextState) {
  try {
    storage.setItem(key, JSON.stringify(nextState.quick));
    return { ok: true, state: nextState };
  } catch {
    return { ok: false, state: currentState };
  }
}

function assertSection(section) {
  if (!FULL_SETTINGS_SECTIONS.includes(section)) throw new Error(`Unknown settings section: ${section}`);
}
