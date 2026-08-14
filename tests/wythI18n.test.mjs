import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORY_LIBRARY, LANGUAGE_LIBRARY } from '../src/companionLogic.js';

import {
  DEFAULT_LOCALE,
  ID_TO_TRANSLATION_KEY,
  WYTH_LOCALES,
  lookupCatalogString,
  normalizeLocale,
  t,
  validateCatalogParity
} from '../src/wythI18n.js';

test('Chinese and English expose identical Wyth interface keys', () => {
  assert.deepEqual(validateCatalogParity(), { ok: true, missing: {} });

  const chineseKeys = Object.keys(WYTH_LOCALES['zh-CN'].strings);
  const englishKeys = Object.keys(WYTH_LOCALES.en.strings);
  assert.deepEqual(chineseKeys.sort(), englishKeys.sort());
  assert.ok(englishKeys.length >= 180, 'catalog should cover the complete commercial interface');
  assert.ok(Object.values(WYTH_LOCALES.en.strings).every((value) => typeof value === 'string' && value.length > 0));
  assert.ok(Object.values(WYTH_LOCALES['zh-CN'].strings).every((value) => typeof value === 'string' && value.length > 0));
});

test('catalog covers every current and planned user-facing surface', () => {
  const requiredKeys = [
    'brand.tagline',
    'onboarding.prompt',
    'chat.replying',
    'chat.placeholder',
    'preset.friend.name',
    'creation.title',
    'avatar.error.tooLarge',
    'profile.title',
    'settings.language',
    'settings.reduceMotion',
    'settings.full.privacy',
    'settings.quick.readingMode',
    'announcement.modelSwitchTitle',
    'announcement.modelSwitchBody',
    'settings.status.active',
    'vocabulary.title',
    'languageAction.translate',
    'model.runtime.title',
    'memory.title',
    'dailyPick.title',
    'empty.chat',
    'error.chatUnavailable',
    'crisis.callEmergency',
    'accessibility.companionList',
    'support.stayWithMe',
    'status.comingSoon'
  ];

  const currentDynamicStudioKeys = [
    'studio.eyebrow',
    'studio.introTitle',
    'studio.introDescription',
    'studio.companionTitle',
    'studio.companionDescription',
    'studio.companionSetup',
    'studio.relationship',
    'studio.language',
    'studio.tone',
    'studio.avatar',
    'studio.closeness',
    'studio.support',
    'studio.careHabit',
    'studio.memory',
    'studio.practiceStyle',
    'studio.correction',
    'studio.level',
    'studio.replyLength',
    'studio.naturalPhrases',
    'studio.careStatus',
    'studio.detectedMood',
    'studio.valence',
    'studio.dailyPush',
    'studio.time',
    'studio.maxDaily',
    'studio.customKeywords',
    'studio.categoryStopHint',
    'studio.savedPicks',
    'studio.wordBook',
    'studio.retrievalPlan',
    'studio.notificationPreview',
    'studio.notifications',
    'studio.quietHours',
    'studio.localScheduler',
    'studio.lastCheck',
    'studio.lastAlerts',
    'studio.sourceMode',
    'studio.longTermMemory',
    'studio.storage',
    'studio.savedItems',
    'studio.size',
    'studio.privacyData',
    'studio.profile',
    'studio.aiTraining',
    'enum.mood.lonely',
    'enum.mood.anxious',
    'enum.mood.sad',
    'enum.mood.tired',
    'enum.mood.positive',
    'enum.mood.neutral',
    'enum.valence.negative',
    'enum.valence.positive',
    'enum.valence.neutral',
    'dailyPick.notificationsOff',
    'dailyPick.mutedQuietHours',
    'dailyPick.checkInTitle',
    'dailyPick.sharedTitle'
  ];

  for (const key of [...requiredKeys, ...currentDynamicStudioKeys]) {
    assert.notEqual(WYTH_LOCALES.en.strings[key], undefined, `missing English key: ${key}`);
    assert.notEqual(WYTH_LOCALES['zh-CN'].strings[key], undefined, `missing Chinese key: ${key}`);
  }
});

test('runtime IDs map directly to existing translation keys', () => {
  const runtimeIds = {
    relationship: ['Girlfriend', 'Boyfriend', 'Bestie', 'Mentor', 'Tree hole', 'Knowledge brother'],
    intimacy: ['gentle', 'close', 'deep'],
    supportMode: ['listen_first', 'gentle_advice', 'cheer_up'],
    proactiveCare: ['rarely', 'sometimes', 'daily'],
    correctionMode: ['off', 'gentle_inline', 'after_reply'],
    correctionIntensity: ['light', 'balanced', 'detailed'],
    replyLength: ['short', 'medium', 'long'],
    avatarStyle: ['Soft anime portrait', 'Clean realistic portrait', 'Minimal illustrated portrait', 'Dreamy editorial portrait'],
    practiceLanguage: Object.keys(LANGUAGE_LIBRARY),
    provider: ['youtube', 'news', 'reddit', 'web_search'],
    category: Object.keys(CATEGORY_LIBRARY),
    mood: ['lonely', 'anxious', 'sad', 'tired', 'positive', 'neutral'],
    valence: ['negative', 'positive', 'neutral']
  };

  for (const [group, ids] of Object.entries(runtimeIds)) {
    for (const id of ids) {
      const key = ID_TO_TRANSLATION_KEY[group]?.[id];
      assert.equal(typeof key, 'string', `missing translation mapping for ${group}:${id}`);
      assert.equal(typeof WYTH_LOCALES.en.strings[key], 'string', `mapping points to missing English key: ${key}`);
      assert.equal(typeof WYTH_LOCALES['zh-CN'].strings[key], 'string', `mapping points to missing Chinese key: ${key}`);
    }
  }
});

test('catalog covers every current creation enum, provider, language, and Daily Pick category', () => {
  const requiredEnumKeys = [
    'enum.relationship.girlfriend',
    'enum.relationship.boyfriend',
    'enum.relationship.bestie',
    'enum.relationship.mentor',
    'enum.relationship.treeHole',
    'enum.relationship.knowledgeBrother',
    'enum.intimacy.gentle',
    'enum.intimacy.close',
    'enum.intimacy.deep',
    'enum.support.listenFirst',
    'enum.support.gentleAdvice',
    'enum.support.cheerUp',
    'enum.proactiveCare.rarely',
    'enum.proactiveCare.sometimes',
    'enum.proactiveCare.daily',
    'enum.correctionMode.off',
    'enum.correctionMode.gentleInline',
    'enum.correctionMode.afterReply',
    'enum.correctionIntensity.light',
    'enum.correctionIntensity.balanced',
    'enum.correctionIntensity.detailed',
    'enum.replyLength.short',
    'enum.replyLength.medium',
    'enum.replyLength.long',
    'enum.avatarStyle.softAnime',
    'enum.avatarStyle.cleanRealistic',
    'enum.avatarStyle.minimalIllustrated',
    'enum.avatarStyle.dreamyEditorial',
    'enum.practiceLanguage.english',
    'enum.practiceLanguage.japanese',
    'enum.practiceLanguage.korean',
    'enum.practiceLanguage.french',
    'enum.practiceLanguage.spanish',
    'enum.practiceLanguage.german',
    'enum.practiceLanguage.italian',
    'enum.provider.youtube',
    'enum.provider.news',
    'enum.provider.reddit',
    'enum.provider.webSearch',
    'enum.category.funnyVideos',
    'enum.category.worldNews',
    'enum.category.techNews',
    'enum.category.psychology',
    'enum.category.healingNews',
    'enum.category.music',
    'enum.category.deepReads',
    'enum.category.localEvents',
    'enum.category.dailyJokes',
    'enum.category.internetMemes'
  ];

  for (const key of requiredEnumKeys) {
    for (const locale of ['zh-CN', 'en']) {
      assert.equal(typeof WYTH_LOCALES[locale].strings[key], 'string', `missing ${locale} enum key: ${key}`);
      assert.ok(WYTH_LOCALES[locale].strings[key].length > 0, `empty ${locale} enum key: ${key}`);
    }
  }
});

test('normalizes supported locale families and defaults unknown locales to Chinese', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hans-CN'), 'zh-CN');
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('EN_gb'), 'en');
  assert.equal(normalizeLocale('english'), 'zh-CN');
  assert.equal(normalizeLocale('enochian'), 'zh-CN');
  assert.equal(normalizeLocale('zhang'), 'zh-CN');
  assert.equal(normalizeLocale('fr'), 'zh-CN');
  assert.equal(normalizeLocale(null), 'zh-CN');
});

test('catalog lookup ignores properties inherited from Object.prototype', () => {
  assert.equal(lookupCatalogString(WYTH_LOCALES, 'en', 'toString'), 'toString');
  assert.equal(lookupCatalogString(WYTH_LOCALES, 'zh-CN', 'constructor'), 'constructor');
  assert.equal(t('en', 'toString'), 'toString');
});

test('catalog lookup ignores non-string own values before falling back', () => {
  const malformedCatalogs = {
    'zh-CN': { strings: { fallback: null, invalid: { text: 'not a string' } } },
    en: { strings: { fallback: 'English fallback', invalid: 42 } }
  };

  assert.equal(lookupCatalogString(malformedCatalogs, 'zh-CN', 'fallback'), 'English fallback');
  assert.equal(lookupCatalogString(malformedCatalogs, 'zh-CN', 'invalid'), 'invalid');
  assert.doesNotThrow(() => t('en', 'chat.replying', null));
});

test('looks up strings, falls back safely, and exposes document metadata', () => {
  assert.equal(t('zh-CN', 'missing.key'), 'missing.key');
  assert.equal(t('en', 'settings.language'), 'Interface language');
  assert.equal(WYTH_LOCALES.en.meta.htmlLang, 'en');
  assert.equal(WYTH_LOCALES['zh-CN'].meta.htmlLang, 'zh-CN');
});

test('falls back to English before returning the key when a locale catalog is incomplete', () => {
  const partialCatalogs = {
    'zh-CN': { strings: { 'only.chinese': '仅中文' } },
    en: { strings: { 'english.fallback': 'English fallback' } }
  };

  assert.equal(
    lookupCatalogString(partialCatalogs, 'zh-CN', 'english.fallback'),
    'English fallback'
  );
  assert.equal(
    lookupCatalogString(partialCatalogs, 'zh-CN', 'missing.everywhere'),
    'missing.everywhere'
  );
});

test('catalog parity reports injected missing and extra own keys', () => {
  const injected = {
    en: { strings: { shared: 'Shared', required: 'Required' } },
    'zh-CN': { strings: { shared: '共有', unexpected: '多余' } }
  };

  assert.deepEqual(validateCatalogParity(injected), {
    ok: false,
    missing: {
      'zh-CN': { absent: ['required'], extra: ['unexpected'] }
    }
  });
});

test('interpolates values without rewriting user content or unresolved placeholders', () => {
  assert.equal(t('zh-CN', 'chat.replying', { name: 'Mia' }), 'Mia 正在回复…');
  assert.equal(t('en', 'chat.replying', { name: '<Mia & You>' }), '<Mia & You> is replying…');
  assert.equal(t('en', 'accessibility.removeWord'), 'Remove {word}');
  assert.equal(t('en', 'chat.replying', null), '{name} is replying…');
});

test('catalog contains the first-use gate and profile-completion language', () => {
  const requiredKeys = [
    'onboarding.language.title',
    'onboarding.language.description',
    'onboarding.birthday.title',
    'onboarding.birthday.label',
    'onboarding.birthday.privacy',
    'onboarding.birthday.invalid',
    'onboarding.birthday.future',
    'onboarding.birthday.ageRange',
    'onboarding.prompt',
    'onboarding.promptHint',
    'onboarding.existingUserPrompt'
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof WYTH_LOCALES.en.strings[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof WYTH_LOCALES['zh-CN'].strings[key], 'string', `missing Chinese key: ${key}`);
  }
});

test('translated option labels keep canonical stored IDs outside the catalog', () => {
  const canonicalIds = {
    relationship: ['Girlfriend', 'Boyfriend', 'Bestie', 'Mentor', 'Tree hole', 'Knowledge brother'],
    avatarStyle: ['Soft anime portrait', 'Clean realistic portrait', 'Minimal illustrated portrait', 'Dreamy editorial portrait']
  };

  for (const [group, ids] of Object.entries(canonicalIds)) {
    for (const id of ids) assert.equal(typeof ID_TO_TRANSLATION_KEY[group][id], 'string');
  }
});
