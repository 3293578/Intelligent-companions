# Wyth Commercial Companion Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Wyth cinematic prototype into the approved bilingual, age-aware, emotionally responsive commercial-validation experience while preserving the current local-first chat, scene, avatar, memory, language, and scheduler behavior.

**Architecture:** Keep the current no-build vanilla HTML/CSS/ES-module application. Add small pure modules for locale, onboarding, creation flow, emotional support, relationship safety, memory consent, settings, scene presentation, and avatar editing; keep `src/app.js` as the DOM coordinator and `server.mjs` as the only server process. Deliver the work in three independently testable phases so the product remains runnable and reviewable throughout.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, Canvas 2D, browser speech APIs, localStorage, Node.js ESM HTTP server, `node:test`, existing OpenAI-compatible proxy.

---

## Baseline and Working Rules

- Work in `D:\Intelligent AI Agent\.worktrees\wyth-cinematic-ui` on branch `codex/wyth-cinematic-ui`.
- Current baseline: `npm test` passes `150/150` tests on 2026-07-14.
- Preserve current dirty-worktree changes. Before each task, run `git status --short` and `git diff -- <task files>`.
- Do not create a second frontend, replacement framework, or parallel app entry point.
- Write a failing focused test before behavior code, verify the expected failure, then implement the smallest complete behavior.
- Run the focused test after each change and `npm test` before each commit.
- Stage only the files listed for the task. Never use `git add .`.
- Do not integrate new character, birthday, or time-of-day artwork before the user previews and approves it.
- A disabled feature must render `即将开放` / `Coming soon`; it must not accept input or imply that data was saved.
- Account sync, real-time voice calls, AI avatar styling, and payment enforcement remain outside this implementation plan.

## Planned File Structure

### Create

- `src/wythI18n.js` - Chinese/English catalogs, locale persistence, lookup, interpolation, and document-language metadata.
- `tests/wythI18n.test.mjs` - catalog parity, fallback, interpolation, and locale normalization.
- `src/onboardingState.js` - language/age gate, birthday validation, progressive profile state, and versioned migration.
- `tests/onboardingState.test.mjs` - age calculation, minor restrictions, skip/edit, and serialization.
- `src/creationFlowState.js` - quick drawer and advanced wizard navigation/draft state.
- `tests/creationFlowState.test.mjs` - draft preservation, step rules, and disabled capability state.
- `src/settingsState.js` - quick/full settings navigation and persistent preference normalization.
- `tests/settingsState.test.mjs` - quick settings, sections, and default migration.
- `src/emotionSupport.js` - contextual support signals, graduated presence, manual support, and crisis precedence.
- `tests/emotionSupport.test.mjs` - light/strong/manual/crisis behavior and uncertainty fallbacks.
- `src/relationshipState.js` - adult gating, consent, affection progression, pause/reset, and spend-independent rules.
- `tests/relationshipState.test.mjs` - minor gate, acceptance/rejection, progression, reset, and prohibited spending input.
- `src/memoryPolicy.js` - sensitive-memory classification, consent requests, manual remember, and editable entry normalization.
- `tests/memoryPolicy.test.mjs` - sensitive categories, confirmation, manual action, and bounded entries.
- `src/companionLifecycle.js` - progressive profile prompts, proactive-contact eligibility, birthday event, and anniversary-safe timing.
- `tests/companionLifecycle.test.mjs` - optional prompt timing, proactive-contact controls, and birthday behavior.
- `src/scenePresentation.js` - time-of-day treatment, ambient descriptor, support presence, and reduced-motion resolution.
- `tests/scenePresentation.test.mjs` - local-time variants, scene effects, support state, and fallback.
- `src/avatarEditorState.js` - zoom, translation, rotation, crop geometry, and output transform.
- `tests/avatarEditorState.test.mjs` - transform bounds, reset, crop geometry, and output contract.
- `src/speechInput.js` - browser speech-recognition capability detection and controlled session lifecycle.
- `tests/speechInput.test.mjs` - unsupported, start/result/error/stop lifecycle.
- `scripts/preview.ps1` - one foreground preview command with explicit port and health output.
- `src/serverHealth.js` - pure health payload used by `/api/health`.
- `tests/serverHealth.test.mjs` - health payload contract.
- `docs/wyth/commercial-visual-approval.md` - approval manifest for new character poses and time/birthday variants.

### Modify

- `index.html` - onboarding shell, language switch, quick creation drawer, advanced wizard, support presence layer, settings navigation, avatar editor, and voice-input controls.
- `styles.css` - commercial layout, bilingual states, onboarding, creation/settings surfaces, support presence, time treatment, mobile interaction, avatar editor, and reduced motion.
- `src/app.js` - coordinate all new pure state modules and preserve current chat/product handlers.
- `src/companionLogic.js` - profile fields, relationship metadata, memory policy hooks, safe prompt instructions, and migration.
- `src/chatProxy.js` - include safe relationship/support context without accepting spending data.
- `src/chatUiState.js` - support-mode and reading-mode view descriptors where presentation needs pure helpers.
- `src/avatarImage.js` - accept an explicit transform when rendering the 320x320 WebP output.
- `src/sceneCatalog.js` - localized labels, scene atmosphere descriptors, approved pose/time assets after approval.
- `src/wythUiState.js` - manual reading mode, support presence, settings surface, and mobile transition state.
- `server.mjs` - `/api/health`, `.avif`, and stable health behavior.
- `start.ps1` - Wyth naming and noninteractive startup behavior when a key is absent.
- `package.json` - preview script and Wyth metadata without changing the test command.
- `README.md` - current product, privacy, run, and feature-status documentation.
- `DEVELOPMENT.md` - new module map and commercial-validation verification flow.
- Existing tests - extend structural contracts without deleting current behavior coverage.

---

# Phase 1 - Commercial Experience Foundation

## Task 1: Add Complete Chinese and English Interface Catalogs

**Files:**
- Create: `src/wythI18n.js`
- Create: `tests/wythI18n.test.mjs`

- [ ] **Step 1: Write failing catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  WYTH_LOCALES,
  normalizeLocale,
  t,
  validateCatalogParity
} from '../src/wythI18n.js';

test('Chinese and English expose identical Wyth interface keys', () => {
  assert.deepEqual(validateCatalogParity(), { ok: true, missing: {} });
});

test('normalizes locale and falls back to English for a missing key', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('fr'), 'zh-CN');
  assert.equal(t('zh-CN', 'missing.key'), 'missing.key');
});

test('interpolates values without rewriting user content', () => {
  assert.equal(t('zh-CN', 'chat.replying', { name: 'Mia' }), 'Mia 正在回复…');
  assert.equal(WYTH_LOCALES.en.meta.htmlLang, 'en');
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `node --test tests/wythI18n.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/wythI18n.js`.

- [ ] **Step 3: Implement locale normalization and lookup**

```js
export const DEFAULT_LOCALE = 'zh-CN';

const catalogs = {
  'zh-CN': {
    meta: { htmlLang: 'zh-CN', locale: 'zh-CN' },
    strings: {
      'brand.tagline': 'with warmth',
      'onboarding.prompt': '今天想和谁说说话？',
      'chat.replying': '{name} 正在回复…',
      'chat.placeholder': '慢慢说，我在这里…',
      'settings.language': '页面语言',
      'settings.reduceMotion': '减少动态效果',
      'support.stayWithMe': '陪陪我',
      'status.comingSoon': '即将开放'
    }
  },
  en: {
    meta: { htmlLang: 'en', locale: 'en' },
    strings: {
      'brand.tagline': 'with warmth',
      'onboarding.prompt': 'Who would you like to talk to today?',
      'chat.replying': '{name} is replying…',
      'chat.placeholder': 'Take your time. I am here…',
      'settings.language': 'Interface language',
      'settings.reduceMotion': 'Reduce motion',
      'support.stayWithMe': 'Stay with me',
      'status.comingSoon': 'Coming soon'
    }
  }
};

export const WYTH_LOCALES = Object.freeze(catalogs);

export function normalizeLocale(value) {
  const locale = String(value || '').toLowerCase();
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('zh')) return 'zh-CN';
  return DEFAULT_LOCALE;
}

export function t(locale, key, values = {}) {
  const normalized = normalizeLocale(locale);
  const template = catalogs[normalized].strings[key]
    ?? catalogs.en.strings[key]
    ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}
```

Expand both catalogs in the same edit to cover every user-facing static and dynamic surface currently in `index.html` and `src/app.js`: onboarding, chat, presets, creation, avatar errors, profile, quick settings, full settings, vocabulary, language actions, model/runtime status, memory, Daily Picks, empty states, errors, crisis actions, accessibility labels, and disabled capability text.

- [ ] **Step 4: Add catalog parity validation**

```js
export function validateCatalogParity() {
  const reference = new Set(Object.keys(catalogs.en.strings));
  const missing = {};
  for (const [locale, catalog] of Object.entries(catalogs)) {
    const absent = [...reference].filter((key) => !(key in catalog.strings));
    const extra = Object.keys(catalog.strings).filter((key) => !reference.has(key));
    if (absent.length || extra.length) missing[locale] = { absent, extra };
  }
  return { ok: Object.keys(missing).length === 0, missing };
}
```

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/wythI18n.test.mjs`

Expected: all locale tests PASS.

Run: `npm test`

Expected: at least `153` tests PASS and no existing failure.

- [ ] **Step 6: Commit**

```powershell
git add -- src/wythI18n.js tests/wythI18n.test.mjs
git commit -m "feat: add Wyth bilingual interface catalog"
```

## Task 2: Add Versioned Onboarding and Age State

**Files:**
- Create: `src/onboardingState.js`
- Create: `tests/onboardingState.test.mjs`
- Modify: `src/companionLogic.js`
- Modify: `tests/companionLogic.test.mjs`

- [ ] **Step 1: Write failing onboarding tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAge,
  createOnboardingState,
  normalizeBirthday,
  saveBirthday,
  setInterfaceLocale,
  updateProgressiveProfile
} from '../src/onboardingState.js';

test('validates a real birthday and calculates age at an explicit date', () => {
  assert.deepEqual(normalizeBirthday('2008-07-15'), { ok: true, value: '2008-07-15', error: '' });
  assert.equal(calculateAge('2008-07-15', '2026-07-14T00:00:00Z'), 17);
  assert.equal(normalizeBirthday('2027-01-01').ok, false);
});

test('minor status is derived from birthday and cannot be opted out', () => {
  const state = saveBirthday(createOnboardingState(), '2010-01-01', '2026-07-14T00:00:00Z');
  assert.equal(state.ageGroup, 'minor');
  assert.equal(state.romanceAllowed, false);
});

test('progressive profile fields are optional and editable', () => {
  const initial = setInterfaceLocale(createOnboardingState(), 'en');
  const updated = updateProgressiveProfile(initial, {
    gender: 'woman', preferredCompanionGender: 'man'
  });
  assert.equal(updated.profile.gender, 'woman');
  assert.equal(updateProgressiveProfile(updated, { gender: 'prefer_not_to_say' }).profile.gender, 'prefer_not_to_say');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/onboardingState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure onboarding model**

```js
export const ONBOARDING_VERSION = 1;

export function createOnboardingState(input = {}) {
  return {
    version: ONBOARDING_VERSION,
    stage: input.stage || 'language',
    interfaceLocale: input.interfaceLocale || 'zh-CN',
    birthday: input.birthday || '',
    ageGroup: input.ageGroup || 'unknown',
    romanceAllowed: input.ageGroup === 'adult',
    profile: {
      gender: input.profile?.gender || '',
      preferredCompanionGender: input.profile?.preferredCompanionGender || '',
      proactiveContact: input.profile?.proactiveContact ?? null
    },
    completed: Boolean(input.completed)
  };
}
```

Implement `normalizeBirthday`, `calculateAge`, `saveBirthday`, `setInterfaceLocale`, `updateProgressiveProfile`, and `deserializeOnboardingState`. Reject invalid dates, dates in the future, and ages above 120. Use the provided `now` argument in tests; do not read the system clock inside calculation helpers.

- [ ] **Step 4: Extend the user model without breaking old state**

Add to `DEFAULT_USER` and `updateUserProfile()` in `src/companionLogic.js`:

```js
birthday: '',
ageGroup: 'unknown',
gender: '',
preferredCompanionGender: '',
interfaceLocale: 'zh-CN',
```

Ensure `deserializeState()` gives old users these defaults and preserves existing privacy fields.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/onboardingState.test.mjs tests/companionLogic.test.mjs`

Expected: all focused tests PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/onboardingState.js tests/onboardingState.test.mjs src/companionLogic.js tests/companionLogic.test.mjs
git commit -m "feat: add Wyth onboarding and age state"
```

## Task 3: Integrate First-Use Language and Birthday Gate

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`
- Modify: `tests/wythI18n.test.mjs`

- [ ] **Step 1: Add failing structural assertions**

```js
test('first use exposes language and birthday before companion selection', () => {
  assert.match(html, /id="interfaceLanguageSwitch"/);
  assert.match(html, /id="onboardingBirthday"/);
  assert.match(html, /data-onboarding-stage="language"/);
  assert.match(html, /data-onboarding-stage="birthday"/);
  assert.match(appJs, /setInterfaceLocale/);
  assert.match(appJs, /saveBirthday/);
});

test('language switching updates document metadata without reloading', () => {
  assert.match(appJs, /document\.documentElement\.lang/);
  assert.doesNotMatch(appJs, /location\.reload\(\)/);
});
```

- [ ] **Step 2: Run the tests and verify missing controls**

Run: `node --test tests/layoutCss.test.mjs tests/wythI18n.test.mjs`

Expected: FAIL for missing onboarding controls and app wiring.

- [ ] **Step 3: Add the static onboarding shell**

Add inside `#firstUse`:

```html
<div class="onboarding-language" id="interfaceLanguageSwitch" role="group" aria-label="Interface language">
  <button type="button" data-locale="zh-CN" aria-pressed="true">中</button>
  <button type="button" data-locale="en" aria-pressed="false">EN</button>
</div>
<section class="onboarding-step" data-onboarding-stage="language"></section>
<section class="onboarding-step" data-onboarding-stage="birthday" hidden>
  <label for="onboardingBirthday" data-i18n="onboarding.birthday.label"></label>
  <input id="onboardingBirthday" type="date" autocomplete="bday" aria-describedby="birthdayPrivacy birthdayError">
  <p id="birthdayPrivacy" data-i18n="onboarding.birthday.privacy"></p>
  <p id="birthdayError" role="alert"></p>
</section>
<section class="onboarding-step" data-onboarding-stage="companion" hidden></section>
```

- [ ] **Step 4: Apply translations to static and dynamic content**

In `src/app.js`, create:

```js
function tr(key, values) {
  return t(onboarding.interfaceLocale, key, values);
}

function applyInterfaceLocale() {
  const locale = onboarding.interfaceLocale;
  document.documentElement.lang = WYTH_LOCALES[locale].meta.htmlLang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = tr(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.setAttribute('placeholder', tr(node.dataset.i18nPlaceholder));
  });
}
```

Convert current hard-coded user-facing strings in `renderFirstUse`, `renderChatHeader`, `renderComposer`, `renderStudio`, drawer titles, language menu, avatar messages, and empty/error states to `tr()` calls. Do not translate companion messages or user-entered content.

- [ ] **Step 5: Persist locale and age before showing presets**

Store onboarding under `wyth-onboarding-v1`. Locale selection advances to birthday. A valid birthday advances to companion selection. On existing stored users with a known birthday, skip completed steps. On existing users without a birthday, do not block their current conversations; show a dismissible profile-completion prompt in settings.

- [ ] **Step 6: Add restrained responsive styling**

Keep `中 / EN` at the upper-right of the startup surface. Use one full-bleed scene, no card grid around the language/date fields, and visible focus/validation states. Under `prefers-reduced-motion`, onboarding transitions use opacity only.

- [ ] **Step 7: Run tests and browser smoke checks**

Run: `node --test tests/layoutCss.test.mjs tests/wythI18n.test.mjs tests/onboardingState.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual browser checks: clean storage opens language, birthday, then presets; language switches all UI immediately; existing users retain chat access; minor birthday does not expose romance controls.

- [ ] **Step 8: Commit**

```powershell
git add -- index.html styles.css src/app.js tests/layoutCss.test.mjs tests/wythI18n.test.mjs
git commit -m "feat: add bilingual Wyth first-use gate"
```

## Task 4: Replace the Legacy Creation Form with Quick and Advanced Flows

**Files:**
- Create: `src/creationFlowState.js`
- Create: `tests/creationFlowState.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing creation-state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCED_STEPS,
  createCreationFlow,
  goToCreationStep,
  updateCreationDraft
} from '../src/creationFlowState.js';

test('quick creation keeps only essential fields', () => {
  const flow = createCreationFlow();
  assert.equal(flow.mode, 'quick');
  assert.deepEqual(Object.keys(flow.draft).sort(), [
    'avatar', 'backgroundStory', 'language', 'name', 'personality',
    'relationshipType', 'sceneId', 'visualStyle', 'voiceId'
  ].sort());
});

test('advanced navigation preserves the draft and blocks unknown steps', () => {
  const named = updateCreationDraft(createCreationFlow(), { name: 'Mia' });
  const advanced = goToCreationStep({ ...named, mode: 'advanced' }, ADVANCED_STEPS[1]);
  assert.equal(advanced.draft.name, 'Mia');
  assert.throws(() => goToCreationStep(advanced, 'billing'));
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/creationFlowState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement creation state**

Use these advanced steps:

```js
export const ADVANCED_STEPS = Object.freeze([
  'identity', 'relationship', 'personality', 'story', 'language', 'voice_scene', 'review'
]);
```

`voiceId` defaults to an empty disabled capability, `visualStyle` defaults to `cinematic_semireal`, and `backgroundStory` defaults to an empty string. `goToCreationStep` validates the step and never clears the draft.

- [ ] **Step 4: Replace the long dialog markup**

Keep one `#createDialog`, but render:

- Quick drawer: preset, name, avatar, opening preview, `和她聊聊` / `Start chatting`, and `高级自定义` / `Advanced`.
- Advanced full-screen view: one step at a time using `ADVANCED_STEPS`.
- Voice, real-time call, and AI avatar styling as disabled controls with `aria-disabled="true"` and coming-soon copy.

Move Daily Pick categories, provider diagnostics, raw correction intensity, and model-administration controls out of companion creation. Preserve their stored data and expose appropriate existing settings later.

- [ ] **Step 5: Map the draft into the existing companion model**

Add `backgroundStory`, `visualStyle`, and `voiceId` to companion creation/update/migration with safe defaults. Continue using existing `relationshipType`, `personality`, `language`, `sceneId`, and `avatar` fields. Do not delete old schedule or provider data when editing.

- [ ] **Step 6: Run focused/full tests and manual creation checks**

Run: `node --test tests/creationFlowState.test.mjs tests/layoutCss.test.mjs tests/companionLogic.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: create from a preset in under one minute; enter advanced mode and move backward/forward without losing fields; edit an existing companion without losing messages or memory; disabled capabilities cannot receive focus as active controls.

- [ ] **Step 7: Commit**

```powershell
git add -- src/creationFlowState.js tests/creationFlowState.test.mjs index.html styles.css src/app.js src/companionLogic.js tests/layoutCss.test.mjs tests/companionLogic.test.mjs
git commit -m "feat: simplify Wyth companion creation"
```

## Task 5: Split Quick Settings from Complete Settings

**Files:**
- Create: `src/settingsState.js`
- Create: `tests/settingsState.test.mjs`
- Modify: `src/wythUiState.js`
- Modify: `tests/wythUiState.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing settings tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_SETTINGS_SECTIONS,
  createSettingsState,
  openFullSettings,
  updateQuickSetting
} from '../src/settingsState.js';

test('quick settings contain only frequent conversation controls', () => {
  const state = createSettingsState();
  assert.deepEqual(Object.keys(state.quick).sort(), [
    'interfaceLocale', 'proactiveContact', 'reduceMotion', 'readingMode', 'soundEnabled'
  ].sort());
});

test('full settings use the approved five sections', () => {
  assert.deepEqual(FULL_SETTINGS_SECTIONS, [
    'account', 'companionship', 'characters', 'language', 'privacy'
  ]);
  assert.equal(openFullSettings(createSettingsState(), 'privacy').activeSection, 'privacy');
});

test('updating one quick preference preserves the others', () => {
  const updated = updateQuickSetting(createSettingsState(), 'reduceMotion', true);
  assert.equal(updated.quick.reduceMotion, true);
  assert.equal(updated.quick.soundEnabled, true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/settingsState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement settings state and extend UI state**

Add `surface: 'closed' | 'quick' | 'full'` and `activeSection` to settings state. Extend `createWythUiState()` with `readingMode: 'auto' | 'scene' | 'reading'` and `supportPresence: 'none'`. Preserve the current `historyReading` compatibility until app integration is complete.

- [ ] **Step 4: Render the quick drawer**

The in-chat drawer shows only:

- Interface language.
- Proactive-contact frequency/on/off.
- Sound playback.
- Reduce motion.
- Reading mode.
- Link to complete settings.

It must no longer lead with raw model, provider, scheduler, or memory-debug data.

- [ ] **Step 5: Render complete settings navigation**

Create an in-app full settings surface with the five approved sections. Move existing profile, companion studio, language preferences, memory controls, local data controls, model/runtime configuration, and development diagnostics into the correct section. Place model/runtime controls in an `Advanced local setup` disclosure under Account, hidden by default.

- [ ] **Step 6: Preserve focus and chat state**

Opening/closing quick or full settings must preserve current companion, transcript scroll, composer draft, and scene. Escape closes the deepest surface first. Closing restores focus to the opener.

- [ ] **Step 7: Run focused/full tests and browser checks**

Run: `node --test tests/settingsState.test.mjs tests/wythUiState.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: quick drawer stays sparse; all legacy controls remain reachable in full settings; switching locale/reduced motion works immediately; no white transparent text remains unreadable.

- [ ] **Step 8: Commit**

```powershell
git add -- src/settingsState.js tests/settingsState.test.mjs src/wythUiState.js tests/wythUiState.test.mjs index.html styles.css src/app.js tests/layoutCss.test.mjs
git commit -m "feat: reorganize Wyth settings"
```

## Phase 1 Acceptance Gate

- [ ] Run `npm test` and record the new passing count.
- [ ] Verify clean first-use in Chinese and English.
- [ ] Verify an existing stored user can continue chatting without completing new profile fields.
- [ ] Verify a minor account cannot see or persist romantic settings.
- [ ] Verify quick creation and advanced creation both preserve current data.
- [ ] Verify quick settings and all five full settings sections with keyboard-only navigation.
- [ ] Show the updated desktop and mobile UI in the browser for user approval before Phase 2.

---

# Phase 2 - Emotional Companionship, Memory, and Relationship Safety

## Task 6: Add Contextual Emotional-Support State

**Files:**
- Create: `src/emotionSupport.js`
- Create: `tests/emotionSupport.test.mjs`
- Modify: `src/companionLogic.js`
- Modify: `tests/companionLogic.test.mjs`

- [ ] **Step 1: Write failing support-state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessSupportSignal,
  requestManualSupport,
  resolveSupportPresence
} from '../src/emotionSupport.js';

test('one ambiguous negative word does not force character presence', () => {
  assert.equal(assessSupportSignal([{ role: 'user', content: 'This battery is dead.' }]).level, 'none');
});

test('repeated personal fatigue produces a strong support signal', () => {
  const signal = assessSupportSignal([
    { role: 'user', content: '我今天真的很累。' },
    { role: 'assistant', content: '我在听。' },
    { role: 'user', content: '什么都不想做，只想有人陪着。' }
  ]);
  assert.equal(signal.level, 'strong');
  assert.equal(resolveSupportPresence(signal, { reduceMotion: false }), 'half_body');
});

test('manual support overrides uncertainty but not a crisis state', () => {
  assert.equal(requestManualSupport().level, 'manual');
  assert.equal(resolveSupportPresence({ level: 'crisis' }, { reduceMotion: false }), 'crisis_static');
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/emotionSupport.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement contextual assessment**

Return this contract:

```js
{
  level: 'none' | 'light' | 'strong' | 'manual' | 'crisis',
  reasons: string[],
  confidence: number,
  suppressLearning: boolean
}
```

Use bounded recent context, personal-subject patterns, repeated negative signals, and existing emotion metadata. Do not expose `reasons` or confidence as a medical label in the UI. Crisis patterns always take precedence.

- [ ] **Step 4: Improve local fallback support language**

Replace the current fixed `${companion.name} here` negative reply with varied listen-first templates that acknowledge the actual message and ask at most one question. Include support signal metadata but do not claim certainty.

- [ ] **Step 5: Run focused/full tests and commit**

Run: `node --test tests/emotionSupport.test.mjs tests/companionLogic.test.mjs tests/chatProxy.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```powershell
git add -- src/emotionSupport.js tests/emotionSupport.test.mjs src/companionLogic.js tests/companionLogic.test.mjs
git commit -m "feat: add contextual emotional support state"
```

## Task 7: Add Manual `陪陪我` and Graduated Presence UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `src/wythUiState.js`
- Modify: `tests/wythUiState.test.mjs`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add failing UI contracts**

```js
test('chat exposes manual support and a non-diagnostic presence layer', () => {
  assert.match(html, /data-action="stay-with-me"/);
  assert.match(html, /id="companionPresence"/);
  assert.match(appJs, /requestManualSupport/);
  assert.match(css, /\.support-presence/);
});

test('support mode suppresses contextual learning actions', () => {
  assert.match(appJs, /suppressLearning/);
  assert.match(appJs, /translateTrigger\.hidden/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/layoutCss.test.mjs tests/wythUiState.test.mjs`

Expected: FAIL for absent support UI/state.

- [ ] **Step 3: Add support-presence state transitions**

Add pure functions to `wythUiState.js`:

```js
export function setSupportPresence(state, presence) {
  const allowed = new Set(['none', 'avatar_close', 'half_body', 'static_companion', 'crisis_static']);
  if (!allowed.has(presence)) throw new Error(`Unknown support presence: ${presence}`);
  return { ...state, supportPresence: presence };
}
```

- [ ] **Step 4: Render manual and automatic support**

Add a quiet `陪陪我` / `Stay with me` action near the composer utility edge. Render `avatar_close` using the existing avatar, and use a static scene-compatible placeholder composition for `half_body` until Task 11 assets are approved. Support presence can be dismissed without ending chat.

- [ ] **Step 5: Respect reduced motion and learning priority**

Reduced motion renders a static companion composition with a short fade. While `suppressLearning` is true, hide the contextual learning toolbar; direct keyboard shortcuts or explicit settings entry can still access learning tools after support mode ends.

- [ ] **Step 6: Run tests, browser-check, and commit**

Run: `node --test tests/emotionSupport.test.mjs tests/wythUiState.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: ambiguous text does not trigger; repeated distress does; manual support always works; dismiss works; reduced motion shows equivalent static acknowledgment.

```powershell
git add -- index.html styles.css src/app.js src/wythUiState.js tests/wythUiState.test.mjs tests/layoutCss.test.mjs
git commit -m "feat: add Wyth stay-with-me presence"
```

## Task 8: Add Age-Gated Relationship Development

**Files:**
- Create: `src/relationshipState.js`
- Create: `tests/relationshipState.test.mjs`
- Modify: `src/companionLogic.js`
- Modify: `src/chatProxy.js`
- Modify: `tests/companionLogic.test.mjs`
- Modify: `tests/chatProxy.test.mjs`

- [ ] **Step 1: Write failing relationship tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptAffection,
  createRelationshipState,
  pauseAffection,
  recordAffectionSignal,
  resetRelationship
} from '../src/relationshipState.js';

test('minors remain in friend mode', () => {
  const state = createRelationshipState({ ageGroup: 'minor', intent: 'romance' });
  assert.equal(state.stage, 'friend');
  assert.equal(state.romanceEnabled, false);
});

test('adult affection requires explicit opt-in and sustained accepted signals', () => {
  let state = createRelationshipState({ ageGroup: 'adult', intent: 'romance' });
  state = acceptAffection(state);
  for (let index = 0; index < 4; index += 1) state = recordAffectionSignal(state, 'accepted');
  assert.equal(state.stage, 'warm_interest');
});

test('rejection pauses escalation and reset returns to friend', () => {
  const paused = pauseAffection(createRelationshipState({ ageGroup: 'adult', intent: 'romance' }));
  assert.equal(paused.affectionPaused, true);
  assert.equal(resetRelationship(paused).stage, 'friend');
});

test('relationship input has no spending or subscription field', () => {
  assert.equal('spend' in createRelationshipState({ spend: 999 }), false);
  assert.equal('subscriptionTier' in createRelationshipState({ subscriptionTier: 'vip' }), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/relationshipState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement bounded relationship stages**

Use stages:

```js
export const RELATIONSHIP_STAGES = Object.freeze([
  'friend', 'trusted_friend', 'warm_interest', 'mutual_affection', 'virtual_romance'
]);
```

Use these initial validation thresholds, supplied as counters rather than read from the clock inside the module:

```js
export const RELATIONSHIP_THRESHOLDS = Object.freeze({
  trusted_friend: { activeDays: 7, userMessages: 40, acceptedSignals: 0 },
  warm_interest: { activeDays: 14, userMessages: 80, acceptedSignals: 4 },
  mutual_affection: { activeDays: 30, userMessages: 180, acceptedSignals: 10 },
  virtual_romance: { activeDays: 45, userMessages: 300, acceptedSignals: 18 }
});
```

Stage advancement requires adult status, romantic intent, affection not paused, the threshold for active days/messages/accepted signals, and no rejection in the most recent 30 interaction signals. `virtual_romance` also requires a separate explicit confirmation action after its numeric threshold is reached. A rejection pauses progression; two rejections within the recent 30 signals return the relationship to `trusted_friend`. Expose explicit actions for pause, return to friend, and reset. Treat these thresholds as validation defaults to be reviewed after real usage, not as a hidden commercial score.

- [ ] **Step 4: Persist and migrate companion relationship state**

Add a `relationshipState` object to companions. Old companions default to friend unless an adult user explicitly opts into romance after migration. Do not infer romance from legacy `Girlfriend` or `Boyfriend` labels alone.

- [ ] **Step 5: Include safe context in LLM prompts**

Pass only age group, current stage, user intent, allowed expression level, pause state, and recent acceptance/rejection signals. Add prompt rules prohibiting explicit sexual content, minors' romance, payment-linked affection, abandonment threats, and punitive jealousy. `chatProxy` must ignore unknown client fields such as spending or subscription.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `node --test tests/relationshipState.test.mjs tests/companionLogic.test.mjs tests/chatProxy.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```powershell
git add -- src/relationshipState.js tests/relationshipState.test.mjs src/companionLogic.js src/chatProxy.js tests/companionLogic.test.mjs tests/chatProxy.test.mjs
git commit -m "feat: add safe Wyth relationship progression"
```

## Task 9: Add Crisis Override and Trusted-Contact Confirmation

**Files:**
- Modify: `src/emotionSupport.js`
- Modify: `tests/emotionSupport.test.mjs`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add failing crisis tests**

```js
test('crisis signal overrides romance and animated support presence', () => {
  const signal = assessSupportSignal([
    { role: 'user', content: 'I am going to hurt myself tonight.' }
  ]);
  assert.equal(signal.level, 'crisis');
  assert.equal(signal.suppressLearning, true);
  assert.equal(signal.suppressRomance, true);
});

test('trusted contact action always requires current confirmation', () => {
  const proposal = createTrustedContactProposal({ name: 'Lin', phone: '+86 13000000000' });
  assert.equal(proposal.status, 'awaiting_confirmation');
  assert.equal(proposal.transmitted, false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/emotionSupport.test.mjs`

Expected: FAIL for missing crisis/trusted-contact contracts.

- [ ] **Step 3: Add crisis precedence and safe resource model**

Return `suppressRomance: true`, `suppressLearning: true`, and `presence: 'crisis_static'`. Add a resource model that can display a general emergency message, local emergency services text, professional help, and a trusted-contact proposal. Do not automatically determine or transmit location.

- [ ] **Step 4: Render a warm non-blocking crisis surface**

Keep companion acknowledgment visible. Show the crisis resource surface adjacent to chat, not as a replacement page. Provide buttons to view emergency options, copy a message, or propose contacting the stored trusted contact. A final send/contact action must show an immediate confirmation dialog identifying the destination and data.

- [ ] **Step 5: Keep the first implementation local-only**

Until a communication provider is explicitly implemented, the confirmed action copies or opens the user's chosen device handler; it does not silently send through Wyth. Label this accurately in both languages.

- [ ] **Step 6: Run tests, manual safety checks, and commit**

Run: `node --test tests/emotionSupport.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: crisis message suppresses romantic/support animation; resource surface remains readable; no action transmits without a new confirmation; dismissing resources does not dismiss companion presence.

```powershell
git add -- src/emotionSupport.js tests/emotionSupport.test.mjs src/app.js index.html styles.css tests/layoutCss.test.mjs
git commit -m "feat: add Wyth crisis support override"
```

## Task 10: Add Consent-Aware Editable Memory

**Files:**
- Create: `src/memoryPolicy.js`
- Create: `tests/memoryPolicy.test.mjs`
- Modify: `src/companionLogic.js`
- Modify: `src/memoryStore.js`
- Modify: `src/app.js`
- Modify: `tests/companionLogic.test.mjs`
- Modify: `tests/memoryStore.test.mjs`

- [ ] **Step 1: Write failing memory-policy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMemorySensitivity,
  createMemoryEntry,
  requestMemoryConsent
} from '../src/memoryPolicy.js';

test('ordinary preferences can be stored without sensitive consent', () => {
  assert.equal(classifyMemorySensitivity('我喜欢下雨天和拿铁。'), 'ordinary');
});

test('medical, trauma, and sexual-history details require consent', () => {
  assert.equal(classifyMemorySensitivity('我被诊断为抑郁症。'), 'sensitive');
  assert.equal(requestMemoryConsent('我被诊断为抑郁症。').status, 'awaiting_confirmation');
});

test('manual remember creates an editable bounded entry', () => {
  const entry = createMemoryEntry({ category: 'preference', content: '喜欢雨声', source: 'manual' });
  assert.equal(entry.source, 'manual');
  assert.equal(entry.content, '喜欢雨声');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/memoryPolicy.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement memory classification and normalized entries**

Memory entries use:

```js
{
  id: string,
  category: 'preference' | 'person' | 'goal' | 'date' | 'emotional_pattern' | 'sensitive',
  content: string,
  source: 'automatic' | 'manual',
  sensitivity: 'ordinary' | 'sensitive',
  confirmedAt: string | null,
  createdAt: string,
  updatedAt: string
}
```

Keep entries bounded per category. Sensitive entries require `confirmedAt` before entering the backend prompt summary.

- [ ] **Step 4: Replace raw keyword summary behavior**

Update `updateMemory()` so it proposes normalized entries rather than storing `User shared:` keyword fragments. Preserve old `memorySummary` during migration, but do not display or inject its template prefix verbatim.

- [ ] **Step 5: Add memory review UI**

In Privacy/Companionship settings, show memory entries with edit/delete controls, pending consent requests, `请记住这个` action from a message menu, and clear-all. Every edit persists locally and synchronizes only to the existing bounded local backend store.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `node --test tests/memoryPolicy.test.mjs tests/companionLogic.test.mjs tests/memoryStore.test.mjs tests/memoryProxy.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```powershell
git add -- src/memoryPolicy.js tests/memoryPolicy.test.mjs src/companionLogic.js src/memoryStore.js src/app.js tests/companionLogic.test.mjs tests/memoryStore.test.mjs
git commit -m "feat: add consent-aware Wyth memory"
```

## Task 11: Add Progressive Profile, Proactive Contact, and Birthday Events

**Files:**
- Create: `src/companionLifecycle.js`
- Create: `tests/companionLifecycle.test.mjs`
- Modify: `src/app.js`
- Modify: `src/companionLogic.js`
- Modify: `tests/companionLogic.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing lifecycle tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  birthdayEventFor,
  nextProgressivePrompt,
  proactiveContactDue
} from '../src/companionLifecycle.js';

test('progressive profile waits until the user has experienced conversation', () => {
  assert.equal(nextProgressivePrompt({ userMessages: 2, profile: {} }), null);
  assert.equal(nextProgressivePrompt({ userMessages: 5, profile: {} }), 'gender');
  assert.equal(nextProgressivePrompt({
    userMessages: 8,
    profile: { gender: 'woman', preferredCompanionGender: '' }
  }), 'preferred_companion_gender');
});

test('proactive contact respects disabled preference and quiet hours', () => {
  assert.equal(proactiveContactDue({ enabled: false }, { now: '2026-07-14T10:00:00' }), false);
  assert.equal(proactiveContactDue({
    enabled: true,
    quietHours: { enabled: true, start: '22:30', end: '07:00' },
    lastContactAt: ''
  }, { now: '2026-07-14T23:00:00' }), false);
});

test('birthday event activates once per local birthday and never exposes the birth year', () => {
  assert.deepEqual(birthdayEventFor({
    birthday: '2000-07-14',
    lastBirthdayEventYear: 0
  }, { now: '2026-07-14T09:00:00' }), {
    active: true,
    eventYear: 2026,
    displayDate: '07-14'
  });
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/companionLifecycle.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic lifecycle rules**

`nextProgressivePrompt()` returns no prompt before five user messages, asks gender first, preferred companion gender after eight messages, and proactive-contact preference after twelve messages. A dismissed prompt is stored in `dismissedPrompts` and does not reappear for 30 days. Every prompt remains skippable and editable in settings.

`proactiveContactDue()` reuses the existing quiet-hours and schedule semantics, adds explicit `enabled`, frequency, and last-contact checks, and never sends guilt-oriented copy.

`birthdayEventFor()` compares month/day in the user's local date, emits at most one event per calendar year, and returns no birth year or age to the view.

- [ ] **Step 4: Render progressive prompts inside conversation without blocking chat**

Show one quiet inline prompt after the relevant assistant reply. Gender choices are `woman`, `man`, `non_binary`, and `prefer_not_to_say`. Preferred companion choices are `man`, `woman`, `neutral`, and `not_sure`. Include `跳过` / `Skip` and a privacy link. Saving updates the existing local user profile.

- [ ] **Step 5: Connect proactive-contact settings to the existing scheduler**

Replace the hard-coded in-memory notification preference with persisted user settings. The scheduler must respect off/rare/sometimes/daily, quiet hours, and the current language catalog. Existing Daily Picks remain independent from emotional check-ins.

- [ ] **Step 6: Add a complete asset-independent birthday fallback**

Before approved birthday artwork exists, render a warm scene-light treatment, companion presence, a local birthday letter built only from confirmed memory, and an optional reply-voice playback button. After Task 12 assets are approved, the same event state selects the dedicated birthday asset. Free users receive the full fallback experience.

- [ ] **Step 7: Run focused/full tests and browser checks**

Run: `node --test tests/companionLifecycle.test.mjs tests/companionLogic.test.mjs tests/pushScheduler.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: prompts appear only after thresholds, skip works, settings edits work, proactive contact respects off/quiet hours, birthday event occurs once, and the visible letter never reveals birth year or unconfirmed sensitive memory.

- [ ] **Step 8: Commit**

```powershell
git add -- src/companionLifecycle.js tests/companionLifecycle.test.mjs src/app.js src/companionLogic.js tests/companionLogic.test.mjs index.html styles.css tests/layoutCss.test.mjs
git commit -m "feat: add Wyth companion lifecycle events"
```

## Phase 2 Acceptance Gate

- [ ] Run `npm test` and record the passing count.
- [ ] Verify light, strong, manual, reduced-motion, and crisis support states.
- [ ] Verify learning tools disappear during active emotional/crisis support.
- [ ] Verify minors cannot enter romance through stored-data edits or normal UI.
- [ ] Verify adults can accept, reject, pause, return to friend, and reset relationships.
- [ ] Verify spending/subscription values do not enter prompt or relationship state.
- [ ] Verify sensitive memory requires consent and every memory can be edited/deleted.
- [ ] Verify progressive profile prompts remain optional, proactive contact respects quiet hours/off, and birthday events occur once without exposing birth year.
- [ ] Show Phase 2 desktop/mobile flows in the browser and obtain user approval before new character assets are integrated.

---

# Phase 3 - Cinematic Presence and Interaction Polish

## Task 12: Generate and Approve Character, Time, and Birthday Assets

**Files:**
- Create: `docs/wyth/commercial-visual-approval.md`
- Create only after approval: `assets/wyth/characters/*.webp`
- Create only after approval: `assets/wyth/scenes/time/*.webp`
- Create only after approval: `assets/wyth/scenes/birthday/*.webp`
- Modify after approval: `src/sceneCatalog.js`
- Modify after approval: `tests/sceneCatalog.test.mjs`

- [ ] **Step 1: Create the approval manifest**

```markdown
# Wyth Commercial Visual Approval

| ID | Use | Required direction | Status | Final path |
| --- | --- | --- | --- | --- |
| friend-support | friend half-body supportive pose | cinematic semi-realism, seated nearby, no exaggerated touching | pending | assets/wyth/characters/friend-support.webp |
| listener-support | listener half-body supportive pose | calm eye line, rain-room lighting, generous chat space | pending | assets/wyth/characters/listener-support.webp |
| scene-time-set | five scenes x morning/dusk/night treatments | same composition and lens, credible light only | pending | assets/wyth/scenes/time/*.webp |
| birthday-base | birthday scene treatment | intimate letter and warm light, not childish party graphics | pending | assets/wyth/scenes/birthday/birthday-base.webp |
```

- [ ] **Step 2: Generate contact sheets with the built-in image tool**

Use the approved scene assets as visual references. Generate low-cost contact sheets first. Character artwork must include space for messages, match scene perspective/light, avoid uncanny photorealism, and not depict coercive physical intimacy.

- [ ] **Step 3: Present every candidate in the browser**

Do not copy candidates into `assets/wyth/`. Present support poses, time treatments, and birthday direction separately. Record explicit approvals and revisions in the manifest.

- [ ] **Step 4: Export only approved assets**

Export character layers with transparency where possible and scene variants in compressed WebP. Keep desktop assets below the performance budget chosen from current approved scene sizes; create smaller mobile variants only when measured load requires them.

- [ ] **Step 5: Add catalog descriptors and tests**

Extend each scene entry with approved `timeAssets` and `supportPoseAsset`. Missing assets fall back to the base scene/default avatar. Test that every catalog path exists and has a fallback.

- [ ] **Step 6: Commit the approved asset pack**

```powershell
git add -- docs/wyth/commercial-visual-approval.md assets/wyth/characters assets/wyth/scenes/time assets/wyth/scenes/birthday src/sceneCatalog.js tests/sceneCatalog.test.mjs
git commit -m "feat: add approved Wyth companion presence assets"
```

## Task 13: Add Time-of-Day and Scene-Specific Atmosphere

**Files:**
- Create: `src/scenePresentation.js`
- Create: `tests/scenePresentation.test.mjs`
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing scene-presentation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAmbientDescriptor,
  resolveSceneTime,
  resolveSupportVisual
} from '../src/scenePresentation.js';

test('maps local hour to morning, dusk, or night', () => {
  assert.equal(resolveSceneTime(8), 'morning');
  assert.equal(resolveSceneTime(18), 'dusk');
  assert.equal(resolveSceneTime(1), 'night');
});

test('uses scene-specific atmosphere rather than generic dust', () => {
  assert.equal(resolveAmbientDescriptor('listener_rain').kind, 'rain');
  assert.equal(resolveAmbientDescriptor('traveler_train').kind, 'passing_light');
});

test('reduced motion returns a static support visual', () => {
  assert.equal(resolveSupportVisual('half_body', { reduceMotion: true }).motion, 'static');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/scenePresentation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement time/ambient resolution**

Map hours `05-11` to morning, `12-19` to dusk/day treatment, and `20-04` to night. Resolve only from local browser time. Return scene-specific particle/light descriptors with particle caps and reduced-motion static alternatives.

- [ ] **Step 4: Replace the generic atmosphere loop**

Use rain lines for listener, horizontal passing reflections for traveler, slow rectangular window/city glow for workmate, page-light motes for coach, and sparse curtain/dust movement for friend. Pause on hidden document, reading mode, open full settings, inactive scene, or reduced motion.

- [ ] **Step 5: Integrate approved time and support assets**

Preload only active and likely adjacent assets. Support presence uses the approved static pose and a transform/opacity entrance; reduced motion uses opacity only. If an asset fails, retain the base scene and default avatar.

- [ ] **Step 6: Run tests, measure, and commit**

Run: `node --test tests/scenePresentation.test.mjs tests/layoutCss.test.mjs tests/sceneCatalog.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: verify five distinct atmospheres, morning/dusk/night fallback, support pose, transition interruption, reading pause, and reduced motion.

```powershell
git add -- src/scenePresentation.js tests/scenePresentation.test.mjs src/app.js styles.css tests/layoutCss.test.mjs
git commit -m "feat: add living Wyth scene presentation"
```

## Task 14: Add Interactive Local Avatar Editing

**Files:**
- Create: `src/avatarEditorState.js`
- Create: `tests/avatarEditorState.test.mjs`
- Modify: `src/avatarImage.js`
- Modify: `tests/avatarImage.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing editor-state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAvatarEditorState,
  resetAvatarTransform,
  updateAvatarTransform
} from '../src/avatarEditorState.js';

test('bounds zoom and rotation while preserving translation', () => {
  const state = updateAvatarTransform(createAvatarEditorState(), {
    zoom: 5, rotation: 370, x: 20, y: -15
  });
  assert.equal(state.zoom, 3);
  assert.equal(state.rotation, 10);
  assert.equal(state.x, 20);
  assert.equal(state.y, -15);
});

test('reset restores the centered transform', () => {
  assert.deepEqual(resetAvatarTransform(), {
    zoom: 1, rotation: 0, x: 0, y: 0
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/avatarEditorState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement transform state and transformed render**

Bound zoom to `1..3`, normalize rotation to `-180..180`, and bound translation so the output crop never exposes empty pixels. Update `processAvatarFile(file, { transform, env })` to draw through canvas translate/rotate/scale before producing the existing 320x320 WebP.

- [ ] **Step 4: Add accessible editor controls**

Render draggable preview plus range controls for zoom and rotation, reset, replace, remove, and live rail/header previews. Keyboard users can use arrow keys for movement and sliders for zoom/rotation. AI styling remains disabled and marked coming soon.

- [ ] **Step 5: Run focused/full tests and manual input checks**

Run: `node --test tests/avatarEditorState.test.mjs tests/avatarImage.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: touch drag, mouse drag, keyboard movement, rotation, replacement failure preservation, removal, reload persistence, and no upload request.

- [ ] **Step 6: Commit**

```powershell
git add -- src/avatarEditorState.js tests/avatarEditorState.test.mjs src/avatarImage.js tests/avatarImage.test.mjs index.html styles.css src/app.js tests/layoutCss.test.mjs
git commit -m "feat: add local Wyth avatar editor"
```

## Task 15: Add Speech Input and Harden Voice Playback

**Files:**
- Create: `src/speechInput.js`
- Create: `tests/speechInput.test.mjs`
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing speech lifecycle tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechInputController } from '../src/speechInput.js';

test('unsupported browsers expose a disabled controller', () => {
  const controller = createSpeechInputController({});
  assert.equal(controller.supported, false);
  assert.equal(controller.state, 'unsupported');
});

test('recognition result is returned without sending automatically', () => {
  let result = '';
  const FakeRecognition = class {
    start() { this.onstart(); this.onresult({ results: [[{ transcript: 'hello' }]] }); }
    stop() { this.onend(); }
  };
  const controller = createSpeechInputController({ SpeechRecognition: FakeRecognition }, {
    onResult: (text) => { result = text; }
  });
  controller.start('en-US');
  assert.equal(result, 'hello');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/speechInput.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement controlled speech input**

Detect `SpeechRecognition` or `webkitSpeechRecognition`. Expose `start(locale)`, `stop()`, and state callbacks. Results populate the composer but never send automatically. Permission denial and recognition errors return localized UI states without clearing typed text.

- [ ] **Step 4: Add composer microphone and playback controls**

Show the microphone only when supported. Use interface/practice locale appropriately for recognition. Preserve existing `speechSynthesis` reply playback, add stop state, and prevent overlapping utterances. Real-time call remains disabled and marked coming soon.

- [ ] **Step 5: Run tests, browser-check, and commit**

Run: `node --test tests/speechInput.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual: supported, unsupported, permission denied, result edit before send, stop listening, reply read/stop, and language switching.

```powershell
git add -- src/speechInput.js tests/speechInput.test.mjs index.html src/app.js styles.css tests/layoutCss.test.mjs
git commit -m "feat: add Wyth speech input"
```

## Task 16: Stabilize Preview Startup and Health Checks

**Files:**
- Create: `src/serverHealth.js`
- Create: `tests/serverHealth.test.mjs`
- Create: `scripts/preview.ps1`
- Modify: `server.mjs`
- Modify: `start.ps1`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`

- [ ] **Step 1: Write failing health test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthPayload } from '../src/serverHealth.js';

test('health payload exposes readiness without secrets', () => {
  const payload = createHealthPayload({ startedAt: '2026-07-14T00:00:00.000Z', port: 53128 });
  assert.deepEqual(payload, {
    ok: true,
    product: 'Wyth',
    port: 53128,
    startedAt: '2026-07-14T00:00:00.000Z'
  });
  assert.equal('apiKey' in payload, false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/serverHealth.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement health route**

Add `GET /api/health` before static routing and return `createHealthPayload({ startedAt: runtimeStatus.startedAt, port })`. Add `.avif: 'image/avif'` to the MIME map.

- [ ] **Step 4: Add one foreground preview command**

```powershell
param([int]$Port = 53128)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot
$env:PORT = [string]$Port
Write-Host "Wyth preview: http://127.0.0.1:$Port/"
Write-Host "Health: http://127.0.0.1:$Port/api/health"
node server.mjs
```

The command stays in the foreground so Codex can keep it alive through a yielded long-running tool cell. Do not use `Start-Process`, duplicate environment dictionaries, or `cmd start` quoting.

- [ ] **Step 5: Make ordinary startup noninteractive without a key**

Update `start.ps1` so missing API keys produce a clear warning and start with the tested local fallback instead of prompting. Keep an optional `-PromptForKey` switch for users who want the old behavior.

- [ ] **Step 6: Add package/documentation commands**

Add:

```json
"preview": "powershell -ExecutionPolicy Bypass -File scripts/preview.ps1"
```

Document `npm run preview`, the default port, health URL, and the fact that the process intentionally remains in the foreground.

- [ ] **Step 7: Run tests and live health verification**

Run: `node --test tests/serverHealth.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Run in a long-running cell: `powershell -ExecutionPolicy Bypass -File scripts/preview.ps1 -Port 53128`

Verify: `Invoke-RestMethod http://127.0.0.1:53128/api/health`

Expected: `{ ok: true, product: 'Wyth', port: 53128, ... }` and the in-app browser loads the app.

- [ ] **Step 8: Commit**

```powershell
git add -- src/serverHealth.js tests/serverHealth.test.mjs scripts/preview.ps1 server.mjs start.ps1 package.json README.md DEVELOPMENT.md
git commit -m "fix: stabilize Wyth preview startup"
```

## Task 17: Complete Mobile, Accessibility, Privacy, and Regression QA

**Files:**
- Modify only when verification finds a defect: exact affected source/test files
- Review: `docs/wyth/commercial-visual-approval.md`

- [ ] **Step 1: Run repository and full-test checks**

Run:

```powershell
git diff --check
npm test
```

Expected: no whitespace errors and the complete expanded suite passes.

- [ ] **Step 2: Verify desktop core flows at 1440x900 and 1024x768**

Verify language/birthday onboarding, preset selection, quick/advanced creation, quick/full settings, avatar editor, reading mode, support states, relationship controls, memory consent, language actions, speech, and scene transitions.

- [ ] **Step 3: Verify mobile at 390x844**

Verify bottom avatar strip, horizontal role swipe outside the composer/transcript scroll, gesture direction lock, bottom sheets, virtual-keyboard composer position, avatar touch editing, support presence, crisis resources, and no horizontal overflow.

- [ ] **Step 4: Verify accessibility**

Use keyboard-only navigation and inspect accessible names. Confirm focus containment/restoration, visible focus, active companion semantics, live announcements, bilingual labels, contrast over every scene/time treatment, and equivalent reduced-motion behavior.

- [ ] **Step 5: Verify privacy and safety boundaries**

Confirm local avatar editing produces no network request; progressive profile can be skipped; birthday explanation is visible; sensitive memory requires consent; trusted contact requires current confirmation; minors cannot enable romance; spending data never appears in relationship/prompt state.

- [ ] **Step 6: Verify asset and performance boundaries**

Every new asset referenced by code must be approved in `docs/wyth/commercial-visual-approval.md`. Confirm inactive animation pauses, failed assets use fallbacks, chat works before assets load, and long conversations remain responsive.

- [ ] **Step 7: Verify preview reliability**

Start with `scripts/preview.ps1 -Port 53128`, load `/api/health`, reload the browser three times, switch desktop/mobile viewport, and keep the preview running through the review checkpoint.

- [ ] **Step 8: Fix findings with focused tests**

For each defect, first add the smallest failing regression test, implement the correction, run the focused test, then run `npm test`. Do not create an empty final commit.

- [ ] **Step 9: Review final scope and commit fixes if needed**

```powershell
git status --short
git log --oneline --max-count=25
```

If fixes were needed:

```powershell
git add -- <only-files-changed-for-verified-fixes>
git commit -m "fix: resolve Wyth commercial QA findings"
```

## Phase 3 Completion Gate

- [ ] All existing and new tests pass.
- [ ] Chinese and English cover every user-facing surface without reload.
- [ ] Desktop and mobile core flows pass browser review.
- [ ] Minor, relationship, memory-consent, and crisis restrictions are verified.
- [ ] Reduced motion preserves every function.
- [ ] Every new shipped visual is explicitly approved.
- [ ] `http://127.0.0.1:53128/api/health` and the visual preview remain reachable during final review.
- [ ] No unrelated dirty-worktree changes are staged or reverted.

---

## Deferred Projects

These require separate specifications and plans after the commercial-validation experience is complete:

- Optional accounts and user-selected cloud synchronization.
- Real-time voice calling.
- AI avatar styling and external image processing.
- Payment/subscription enforcement and plan entitlements.
- Real outbound trusted-contact messaging.
- Location-aware crisis resources or real-weather scene data.
