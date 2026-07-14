import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
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

  for (const key of requiredKeys) {
    assert.notEqual(WYTH_LOCALES.en.strings[key], undefined, `missing English key: ${key}`);
    assert.notEqual(WYTH_LOCALES['zh-CN'].strings[key], undefined, `missing Chinese key: ${key}`);
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
  assert.equal(normalizeLocale('fr'), 'zh-CN');
  assert.equal(normalizeLocale(null), 'zh-CN');
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

test('interpolates values without rewriting user content or unresolved placeholders', () => {
  assert.equal(t('zh-CN', 'chat.replying', { name: 'Mia' }), 'Mia 正在回复…');
  assert.equal(t('en', 'chat.replying', { name: '<Mia & You>' }), '<Mia & You> is replying…');
  assert.equal(t('en', 'accessibility.removeWord'), 'Remove {word}');
});
