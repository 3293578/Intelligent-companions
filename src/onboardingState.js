import { normalizeLocale } from './wythI18n.js';

export const ONBOARDING_VERSION = 2;

const GENDERS = new Set(['woman', 'man', 'non_binary', 'prefer_not_to_say', '']);
const COMPANION_GENDERS = new Set(['man', 'woman', 'neutral', 'not_sure', '']);
const STAGES = new Set(['welcome', 'language', 'birthday', 'companion', 'profile', 'complete']);
const EXPERIENCES = new Set(['', 'new', 'returning']);
const VERIFIED_STATE = Symbol('verifiedOnboardingAge');

function normalizeEnum(value, allowed, fallback = '') {
  return allowed.has(value) ? value : fallback;
}

function normalizeProactiveContact(value, fallback = null) {
  return value === true || value === false || value === null ? value : fallback;
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseCalendarDate(value) {
  const match = String(value ?? '').match(
    /^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/
  );
  if (!match || !isRealIsoDate(match[1])) return null;
  const [year, month, day] = match[1].split('-').map(Number);
  return { year, month, day };
}

export function createOnboardingState(input = {}) {
  const profile = input.profile || {};
  const verified = input?.[VERIFIED_STATE] === true
    && isRealIsoDate(String(input.birthday ?? ''))
    && (input.ageGroup === 'adult' || input.ageGroup === 'minor');

  const state = {
    version: ONBOARDING_VERSION,
    stage: STAGES.has(input.stage) ? input.stage : 'welcome',
    experience: EXPERIENCES.has(input.experience) ? input.experience : '',
    interfaceLocale: normalizeLocale(input.interfaceLocale),
    birthday: verified ? input.birthday : '',
    ageGroup: verified ? input.ageGroup : 'unknown',
    romanceAllowed: verified && input.ageGroup === 'adult',
    profile: {
      gender: normalizeEnum(profile.gender, GENDERS),
      preferredCompanionGender: normalizeEnum(
        profile.preferredCompanionGender,
        COMPANION_GENDERS
      ),
      proactiveContact: normalizeProactiveContact(profile.proactiveContact)
    },
    completed: input.completed === true
  };
  if (verified) Object.defineProperty(state, VERIFIED_STATE, { value: true, enumerable: true });
  return state;
}

export function selectOnboardingPath(state, experience) {
  if (experience !== 'new' && experience !== 'returning') return createOnboardingState(state);
  const normalized = createOnboardingState(state);
  return {
    ...normalized,
    experience,
    stage: experience === 'new' ? 'language' : 'welcome'
  };
}

export function shouldShowOnboarding({ companionCount = 0, settingsSurface = 'closed' } = {}) {
  return Number(companionCount) === 0 && settingsSurface !== 'full';
}

export function resolveOnboardingStage({
  authState = 'signed_out',
  companionCount = 0,
  settingsSurface = 'closed',
  stage = 'welcome'
} = {}) {
  if (!shouldShowOnboarding({ companionCount, settingsSurface })) return '';
  if (authState === 'authenticated') return 'companion';
  return ['welcome', 'language', 'birthday', 'companion'].includes(stage)
    ? stage
    : 'companion';
}

export function calculateAge(birthday, now) {
  if (!isRealIsoDate(String(birthday ?? ''))) return null;
  const reference = parseCalendarDate(now);
  if (!reference) return null;

  const [year, month, day] = birthday.split('-').map(Number);
  let age = reference.year - year;
  const currentMonth = reference.month;
  const currentDay = reference.day;
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
  if (!normalized.ok) return createOnboardingState(state);

  const age = calculateAge(normalized.value, now);
  const ageGroup = age >= 18 ? 'adult' : 'minor';
  const current = createOnboardingState(state);
  const saved = {
    ...current,
    birthday: normalized.value,
    ageGroup,
    romanceAllowed: ageGroup === 'adult',
    stage: current.stage === 'language' || current.stage === 'birthday'
      ? 'companion'
      : current.stage
  };
  Object.defineProperty(saved, VERIFIED_STATE, { value: true, enumerable: true });
  return saved;
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
    const persistedStage = STAGES.has(parsed.stage) ? parsed.stage : 'companion';
    const experience = EXPERIENCES.has(parsed.experience)
      ? parsed.experience
      : parsed.version < ONBOARDING_VERSION ? 'new' : '';
    let state = createOnboardingState({
      stage: persistedStage,
      experience,
      interfaceLocale: parsed.interfaceLocale ?? parsed.locale,
      profile: {
        gender: profile.gender ?? parsed.gender,
        preferredCompanionGender:
          profile.preferredCompanionGender ?? parsed.preferredGender,
        proactiveContact: profile.proactiveContact ?? parsed.proactiveContact ?? null
      },
      completed: parsed.completed === true
    });

    if (experience === 'returning' && persistedStage === 'welcome') return state;

    const birthday = parsed.birthday ?? parsed.birthDate;
    const normalizedBirthday = normalizeBirthday(birthday, now);
    if (!normalizedBirthday.ok) {
      return {
        ...state,
        stage: 'birthday',
        birthday: '',
        ageGroup: 'unknown',
        romanceAllowed: false,
        completed: false
      };
    }

    state = saveBirthday(state, normalizedBirthday.value, now);
    if (STAGES.has(parsed.stage)) state = { ...state, stage: parsed.stage };
    return state;
  } catch {
    return createOnboardingState();
  }
}
