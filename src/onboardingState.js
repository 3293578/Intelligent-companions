import { normalizeLocale } from './wythI18n.js';

export const ONBOARDING_VERSION = 1;

const GENDERS = new Set(['woman', 'man', 'non_binary', 'prefer_not_to_say', '']);
const COMPANION_GENDERS = new Set(['man', 'woman', 'neutral', 'not_sure', '']);
const STAGES = new Set(['language', 'birthday', 'companion', 'profile', 'complete']);

function normalizeEnum(value, allowed, fallback = '') {
  return allowed.has(value) ? value : fallback;
}

function normalizeProactiveContact(value, fallback = null) {
  return value === true || value === false || value === null ? value : fallback;
}

function parseReferenceDate(now) {
  const reference = new Date(now);
  return Number.isNaN(reference.getTime()) ? null : reference;
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function createOnboardingState(input = {}) {
  const ageGroup = input.ageGroup === 'adult' || input.ageGroup === 'minor'
    ? input.ageGroup
    : 'unknown';
  const profile = input.profile || {};

  return {
    version: ONBOARDING_VERSION,
    stage: STAGES.has(input.stage) ? input.stage : 'language',
    interfaceLocale: normalizeLocale(input.interfaceLocale),
    birthday: typeof input.birthday === 'string' ? input.birthday : '',
    ageGroup,
    romanceAllowed: ageGroup === 'adult',
    profile: {
      gender: normalizeEnum(profile.gender, GENDERS),
      preferredCompanionGender: normalizeEnum(
        profile.preferredCompanionGender,
        COMPANION_GENDERS
      ),
      proactiveContact: normalizeProactiveContact(profile.proactiveContact)
    },
    completed: Boolean(input.completed)
  };
}

export function calculateAge(birthday, now) {
  if (!isRealIsoDate(String(birthday ?? ''))) return null;
  const reference = parseReferenceDate(now);
  if (!reference) return null;

  const [year, month, day] = birthday.split('-').map(Number);
  let age = reference.getUTCFullYear() - year;
  const currentMonth = reference.getUTCMonth() + 1;
  const currentDay = reference.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age;
}

export function normalizeBirthday(value, now) {
  const birthday = String(value ?? '').trim();
  if (!isRealIsoDate(birthday)) {
    return { ok: false, value: '', error: 'invalid_date' };
  }

  const age = calculateAge(birthday, now);
  if (age === null) {
    return { ok: false, value: '', error: 'invalid_reference_date' };
  }
  if (age < 0) {
    return { ok: false, value: '', error: 'future_date' };
  }
  if (age > 120) {
    return { ok: false, value: '', error: 'age_out_of_range' };
  }
  return { ok: true, value: birthday, error: '' };
}

export function saveBirthday(state, birthday, now) {
  const normalized = normalizeBirthday(birthday, now);
  if (!normalized.ok) return state;

  const age = calculateAge(normalized.value, now);
  const ageGroup = age >= 18 ? 'adult' : 'minor';
  return {
    ...createOnboardingState(state),
    birthday: normalized.value,
    ageGroup,
    romanceAllowed: ageGroup === 'adult',
    stage: state.stage === 'language' || state.stage === 'birthday'
      ? 'companion'
      : createOnboardingState(state).stage
  };
}

export function setInterfaceLocale(state, locale) {
  const normalized = createOnboardingState(state);
  return {
    ...normalized,
    interfaceLocale: normalizeLocale(locale),
    stage: normalized.stage === 'language' ? 'birthday' : normalized.stage
  };
}

export function updateProgressiveProfile(state, updates = {}) {
  const normalized = createOnboardingState(state);
  const profile = { ...normalized.profile };

  if ('gender' in updates && GENDERS.has(updates.gender)) profile.gender = updates.gender;
  if (
    'preferredCompanionGender' in updates
    && COMPANION_GENDERS.has(updates.preferredCompanionGender)
  ) {
    profile.preferredCompanionGender = updates.preferredCompanionGender;
  }
  if (
    'proactiveContact' in updates
    && (updates.proactiveContact === true
      || updates.proactiveContact === false
      || updates.proactiveContact === null)
  ) {
    profile.proactiveContact = updates.proactiveContact;
  }

  return { ...normalized, profile };
}

export function deserializeOnboardingState(raw, now) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return createOnboardingState();
    }

    const profile = parsed.profile && typeof parsed.profile === 'object'
      ? parsed.profile
      : {};
    let state = createOnboardingState({
      stage: parsed.stage,
      interfaceLocale: parsed.interfaceLocale ?? parsed.locale,
      profile: {
        gender: profile.gender ?? parsed.gender,
        preferredCompanionGender:
          profile.preferredCompanionGender ?? parsed.preferredGender,
        proactiveContact: profile.proactiveContact ?? parsed.proactiveContact ?? null
      },
      completed: parsed.completed
    });

    const birthday = parsed.birthday ?? parsed.birthDate;
    if (birthday) state = saveBirthday(state, birthday, now);
    if (STAGES.has(parsed.stage)) state = { ...state, stage: parsed.stage };
    return state;
  } catch {
    return createOnboardingState();
  }
}
