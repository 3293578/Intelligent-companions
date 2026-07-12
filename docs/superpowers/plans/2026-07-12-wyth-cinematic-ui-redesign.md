# Wyth Cinematic UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing three-column English Companions shell with the approved Wyth cinematic companion-chat experience while preserving all existing chat, memory, model, translation, text-to-speech, vocabulary, scheduler, and local-first behavior.

**Architecture:** Keep the no-build vanilla HTML/CSS/ES-module architecture. Extract pure scene, avatar, and UI-state rules into small tested modules; keep `src/app.js` as the DOM controller; represent each companion environment as a catalog entry plus approved layered image assets; use CSS transforms for primary motion and an optional lightweight Canvas atmosphere layer. The implementation is migration-safe: old serialized companions receive deterministic scenes and default avatars.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, browser Canvas 2D, localStorage, Node.js ESM server, `node:test` / `node:assert`, existing OpenAI-compatible proxy.

---

## Working Rules

- The working tree already contains user changes in `index.html`, `styles.css`, `src/app.js`, `src/companionLogic.js`, `src/i18n.js`, and related tests. Before every task, run `git diff -- <listed files>` and preserve those changes.
- Do not integrate any generated or sourced image until the user has previewed and approved it.
- Do not upload user avatar files to any server. Avatar processing stays in the browser.
- Run the focused test after each red/green step and run `npm test` before every task commit.
- Stage only files listed in the current task. Never use `git add .`.
- If the approved asset filenames differ from the names below, update `src/sceneCatalog.js` and its tests together; do not add alias files.

## Planned File Structure

**Create**

- `docs/wyth/visual-asset-approval.md` - asset contact sheet, approval status, final filenames, palettes, and continuity-motif decision.
- `assets/wyth/brand/wyth-wordmark.svg` - approved Wyth wordmark.
- `assets/wyth/scenes/*.webp` - approved responsive scene bases and optional layers.
- `assets/wyth/avatars/*.svg` - approved non-human default avatar marks.
- `src/sceneCatalog.js` - scene metadata, preset companions, deterministic recommendation, and fallback palettes.
- `src/avatarImage.js` - image validation, crop calculation, resize/compression, and storage-safe result types.
- `src/wythUiState.js` - drawer, history-reading, motion preference, and interruptible companion-transition state.
- `src/languageAssistProxy.js` - explicit "say this more naturally" proxy behavior.
- `tests/sceneCatalog.test.mjs` - scene and preset tests.
- `tests/avatarImage.test.mjs` - avatar validation and geometry tests.
- `tests/wythUiState.test.mjs` - pure UI-state tests.
- `tests/languageAssistProxy.test.mjs` - request, prompt, payload, and fallback tests.

**Modify**

- `index.html` - Wyth viewport shell, role rail, scene layers, utility dock, drawer, creation flow, contextual language actions.
- `styles.css` - complete cinematic layout, transitions, drawer, reading mode, responsive behavior, and accessibility states.
- `src/app.js` - render the new shell, coordinate scenes and drawers, handle uploads, and preserve existing feature handlers.
- `src/companionLogic.js` - scene/avatar fields, five presets, old-state migration, and companionship-first defaults.
- `src/chatUiState.js` - contextual message action descriptors if shared by rendering.
- `src/i18n.js` - Wyth labels, drawer labels, first-use copy, upload errors, and language action strings.
- `server.mjs` - serve modern image MIME types and route explicit language-assist requests.
- `package.json` - Wyth package metadata without changing scripts.
- `README.md` - Wyth naming and user-facing layout description.
- `DEVELOPMENT.md` - new module map and verification commands.
- Existing tests under `tests/` - update structural contracts without deleting behavioral coverage.

## Task 1: Produce and Approve the Visual Asset Set

**Files:**
- Create: `docs/wyth/visual-asset-approval.md`
- Later create after approval only: `assets/wyth/brand/wyth-wordmark.svg`
- Later create after approval only: `assets/wyth/scenes/friend-room-base.webp`
- Later create after approval only: `assets/wyth/scenes/listener-rain-base.webp`
- Later create after approval only: `assets/wyth/scenes/traveler-train-base.webp`
- Later create after approval only: `assets/wyth/scenes/workmate-desk-base.webp`
- Later create after approval only: `assets/wyth/scenes/coach-study-base.webp`
- Later create after approval only: `assets/wyth/scenes/shared-warm-thread.webp`
- Later create after approval only: `assets/wyth/avatars/friend.svg`
- Later create after approval only: `assets/wyth/avatars/listener.svg`
- Later create after approval only: `assets/wyth/avatars/traveler.svg`
- Later create after approval only: `assets/wyth/avatars/workmate.svg`
- Later create after approval only: `assets/wyth/avatars/coach.svg`

- [ ] **Step 1: Create the approval manifest before generating assets**

```markdown
# Wyth Visual Asset Approval

| ID | Purpose | Required visual direction | Candidate | Status | Final file |
| --- | --- | --- | --- | --- | --- |
| brand-wordmark | Wyth wordmark | restrained, warm, mature; small-screen legibility | pending | pending | assets/wyth/brand/wyth-wordmark.svg |
| scene-friend | 知心朋友 | lived-in window room at dawn/dusk | pending | pending | assets/wyth/scenes/friend-room-base.webp |
| scene-listener | 安静倾听者 | quiet rain-night room, lamp, negative space | pending | pending | assets/wyth/scenes/listener-rain-base.webp |
| scene-traveler | 旅行伙伴 | train window or early station, gentle movement cues | pending | pending | assets/wyth/scenes/traveler-train-base.webp |
| scene-workmate | 职场搭档 | personal desk, city dusk, non-corporate | pending | pending | assets/wyth/scenes/workmate-desk-base.webp |
| scene-coach | 温柔语言教练 | sunlit study, reading table | pending | pending | assets/wyth/scenes/coach-study-base.webp |
| motif-thread | continuity motif | one warm line of light connecting every scene | pending | pending | assets/wyth/scenes/shared-warm-thread.webp |
| avatar-set | five default avatars | abstract object/symbol marks, no full people | pending | pending | assets/wyth/avatars/*.svg |

Approval rule: no candidate is copied into `assets/wyth/` until the user explicitly approves it.
```

- [ ] **Step 2: Generate a low-cost wordmark contact sheet**

Use the `imagegen` skill and image-generation tool to create one contact sheet containing three Wyth wordmark directions. Keep the background plain and label the options A, B, and C. Present the contact sheet in the conversation and wait for user approval.

- [ ] **Step 3: Generate the five scene candidates as one coherent set**

Use the approved art direction and the same prompt skeleton for every scene:

```text
Quiet cinematic environment for Wyth, a warm AI companion chat product; no visible person; credible lived-in materials; low-saturation natural palette; generous negative space for readable chat; subtle surreal warm thread of light; 16:9 desktop composition; same lens, film grain, contrast, and visual world as the other four Wyth environments; no UI, no text, no purple AI gradients, no glowing orb, no stock-photo look.
```

Add only the role-specific environment description from the manifest. Present all five together as a numbered contact sheet and wait for approval or per-scene revisions.

- [ ] **Step 4: Generate the five default avatar marks**

Create a single contact sheet of five abstract, non-human avatar marks derived from scene objects. Use simple silhouette shapes that remain recognizable at 40px. Present it and wait for approval.

- [ ] **Step 5: Record approvals and export only approved assets**

Update `docs/wyth/visual-asset-approval.md` with the approved option, revision note, palette, and exact file path. Export approved scene bases to WebP, the wordmark and avatar marks to SVG, and the shared motif to a transparent WebP or SVG according to its final form.

- [ ] **Step 6: Verify files and dimensions**

Run:

```powershell
Get-ChildItem assets\wyth -Recurse -File | Select-Object FullName,Length
```

Expected: only user-approved assets exist; every manifest path resolves; no temporary candidates are inside `assets/wyth/`.

- [ ] **Step 7: Commit the approved asset pack**

```powershell
git add -- docs/wyth/visual-asset-approval.md assets/wyth
git commit -m "feat: add approved Wyth visual assets"
```

## Task 2: Add the Scene Catalog and Preset Companions

**Files:**
- Create: `src/sceneCatalog.js`
- Create: `tests/sceneCatalog.test.mjs`

- [ ] **Step 1: Write failing catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_CATALOG,
  WYTH_PRESETS,
  fallbackSceneId,
  recommendSceneId,
  sceneForId
} from '../src/sceneCatalog.js';

test('defines five connected Wyth scenes with approved assets and fallbacks', () => {
  assert.deepEqual(Object.keys(SCENE_CATALOG), [
    'friend_room', 'listener_rain', 'traveler_train', 'workmate_desk', 'coach_study'
  ]);
  for (const scene of Object.values(SCENE_CATALOG)) {
    assert.match(scene.baseAsset, /^assets\/wyth\/scenes\/.+\.webp$/);
    assert.equal(scene.fallback.colors.length, 3);
    assert.ok(scene.ambientEffect);
  }
});

test('defines the approved five first-use presets', () => {
  assert.deepEqual(WYTH_PRESETS.map((preset) => preset.labelZh), [
    '知心朋友', '安静倾听者', '旅行伙伴', '职场搭档', '温柔语言教练'
  ]);
  assert.equal(WYTH_PRESETS.find((preset) => preset.id === 'listener')?.careStyle.supportMode, 'listen_first');
});

test('recommends deterministic scenes from relationship and personality', () => {
  assert.equal(recommendSceneId({ relationshipType: 'Tree hole', personality: 'Quiet listener' }), 'listener_rain');
  assert.equal(recommendSceneId({ relationshipType: 'Mentor', personality: 'Professional partner' }), 'workmate_desk');
  assert.equal(recommendSceneId({ relationshipType: 'Bestie', personality: 'Warm' }), 'friend_room');
});

test('falls back safely for missing scene identifiers', () => {
  assert.equal(fallbackSceneId(), 'friend_room');
  assert.equal(sceneForId('missing').id, 'friend_room');
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `node --test tests/sceneCatalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/sceneCatalog.js`.

- [ ] **Step 3: Implement the catalog and recommendation rules**

```js
export const SCENE_CATALOG = Object.freeze({
  friend_room: {
    id: 'friend_room',
    labelZh: '窗边客厅',
    baseAsset: 'assets/wyth/scenes/friend-room-base.webp',
    avatarAsset: 'assets/wyth/avatars/friend.svg',
    ambientEffect: 'floating_dust',
    fallback: { colors: ['#1d2928', '#806c5c', '#d7b98d'] }
  },
  listener_rain: {
    id: 'listener_rain',
    labelZh: '雨夜灯房',
    baseAsset: 'assets/wyth/scenes/listener-rain-base.webp',
    avatarAsset: 'assets/wyth/avatars/listener.svg',
    ambientEffect: 'soft_rain',
    fallback: { colors: ['#111a24', '#354352', '#b58b68'] }
  },
  traveler_train: {
    id: 'traveler_train',
    labelZh: '清晨列车',
    baseAsset: 'assets/wyth/scenes/traveler-train-base.webp',
    avatarAsset: 'assets/wyth/avatars/traveler.svg',
    ambientEffect: 'passing_light',
    fallback: { colors: ['#263236', '#71868b', '#d4b47b'] }
  },
  workmate_desk: {
    id: 'workmate_desk',
    labelZh: '暮色书桌',
    baseAsset: 'assets/wyth/scenes/workmate-desk-base.webp',
    avatarAsset: 'assets/wyth/avatars/workmate.svg',
    ambientEffect: 'city_glow',
    fallback: { colors: ['#172126', '#46545c', '#c18e64'] }
  },
  coach_study: {
    id: 'coach_study',
    labelZh: '日光书房',
    baseAsset: 'assets/wyth/scenes/coach-study-base.webp',
    avatarAsset: 'assets/wyth/avatars/coach.svg',
    ambientEffect: 'page_light',
    fallback: { colors: ['#48514b', '#9b927d', '#e1cda6'] }
  }
});

export const WYTH_PRESETS = Object.freeze([
  { id: 'friend', labelZh: '知心朋友', sceneId: 'friend_room', relationshipType: 'Bestie', personality: 'Warm, present, and easy to talk to', careStyle: { supportMode: 'listen_first' } },
  { id: 'listener', labelZh: '安静倾听者', sceneId: 'listener_rain', relationshipType: 'Tree hole', personality: 'Patient, quiet, and never in a hurry to fix things', careStyle: { supportMode: 'listen_first' } },
  { id: 'traveler', labelZh: '旅行伙伴', sceneId: 'traveler_train', relationshipType: 'Bestie', personality: 'Curious, observant, and open to small discoveries', careStyle: { supportMode: 'cheer_up' } },
  { id: 'workmate', labelZh: '职场搭档', sceneId: 'workmate_desk', relationshipType: 'Knowledge brother', personality: 'Calm, capable, and supportive without becoming corporate', careStyle: { supportMode: 'gentle_advice' } },
  { id: 'coach', labelZh: '温柔语言教练', sceneId: 'coach_study', relationshipType: 'Mentor', personality: 'Gentle, encouraging, and responsive when language help is requested', careStyle: { supportMode: 'listen_first' } }
]);

export function fallbackSceneId() { return 'friend_room'; }
export function sceneForId(id) { return SCENE_CATALOG[id] || SCENE_CATALOG[fallbackSceneId()]; }

export function recommendSceneId(companion = {}) {
  const text = `${companion.relationshipType || ''} ${companion.personality || ''}`.toLowerCase();
  if (/tree hole|listener|quiet|listen/.test(text)) return 'listener_rain';
  if (/travel|adventure|curious discovery/.test(text)) return 'traveler_train';
  if (/mentor|professional|work|knowledge/.test(text)) return 'workmate_desk';
  if (/coach|teacher|language|study/.test(text)) return 'coach_study';
  return fallbackSceneId();
}
```

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/sceneCatalog.test.mjs`

Expected: 4 tests PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`

Expected: all existing and new tests PASS.

```powershell
git add -- src/sceneCatalog.js tests/sceneCatalog.test.mjs
git commit -m "feat: add Wyth scene catalog and presets"
```

## Task 3: Migrate Companion Data to Scenes and Local Avatars

**Files:**
- Modify: `src/companionLogic.js`
- Modify: `tests/companionLogic.test.mjs`

- [ ] **Step 1: Add failing creation and migration tests**

```js
test('companions receive scene and avatar fields without proactive correction', () => {
  const companion = createCompanion({ name: 'Mia', relationshipType: 'Tree hole' });
  assert.equal(companion.sceneId, 'listener_rain');
  assert.deepEqual(companion.avatar, { kind: 'default', dataUrl: '', mimeType: '' });
  assert.equal(companion.practiceStyle.correctionMode, 'off');
});

test('deserializeState migrates old companions to deterministic Wyth visuals', () => {
  const oldState = {
    selectedCompanionId: 'old',
    companions: [{ id: 'old', name: 'Old friend', relationshipType: 'Bestie', personality: 'Warm' }],
    messages: []
  };
  const restored = deserializeState(JSON.stringify(oldState));
  assert.equal(restored.companions[0].sceneId, 'friend_room');
  assert.equal(restored.companions[0].avatar.kind, 'default');
});

test('updateCompanion preserves the existing custom avatar when avatar input is omitted', () => {
  const companion = createCompanion({
    name: 'Mia',
    avatar: { kind: 'custom', dataUrl: 'data:image/webp;base64,abc', mimeType: 'image/webp' }
  });
  assert.equal(updateCompanion(companion, { personality: 'Calm' }).avatar.kind, 'custom');
});
```

- [ ] **Step 2: Run the focused test and verify failures**

Run: `node --test tests/companionLogic.test.mjs`

Expected: FAIL because scene and avatar properties are absent and correction defaults to `after_reply`.

- [ ] **Step 3: Add normalized scene and avatar fields**

Import `recommendSceneId` and `sceneForId` from `./sceneCatalog.js`, change `DEFAULT_PRACTICE_STYLE.correctionMode` to `off`, and add:

```js
function normalizeAvatar(input = {}) {
  if (input?.kind === 'custom' && /^data:image\/(?:webp|png|jpeg);base64,/.test(input.dataUrl || '')) {
    return {
      kind: 'custom',
      dataUrl: input.dataUrl,
      mimeType: input.mimeType || 'image/webp'
    };
  }
  return { kind: 'default', dataUrl: '', mimeType: '' };
}
```

Extend the `createCompanion()` result:

```js
sceneId: sceneForId(input.sceneId || recommendSceneId(input)).id,
avatar: normalizeAvatar(input.avatar),
```

Extend deserialization and `updateCompanion()` normalization with the same rules. Preserve the old `avatarStyle` and `avatarColor` fields for one migration cycle because existing UI and stored data still reference them during the shell transition.

- [ ] **Step 4: Replace the seed state with the five Wyth presets**

Map `WYTH_PRESETS` through `createCompanion()`. Give each preset a stable ID such as `companion_preset_listener`, and create one welcome message per preset using `buildWelcomeContent()`.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/companionLogic.test.mjs`

Expected: all companion tests PASS after updating assertions that intentionally depended on proactive correction.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/companionLogic.js tests/companionLogic.test.mjs
git commit -m "feat: migrate companions to Wyth scenes and avatars"
```

## Task 4: Add Browser-Local Avatar Processing

**Files:**
- Create: `src/avatarImage.js`
- Create: `tests/avatarImage.test.mjs`

- [ ] **Step 1: Write failing pure validation and crop tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarCrop, validateAvatarFile } from '../src/avatarImage.js';

test('accepts supported local avatar image metadata', () => {
  assert.deepEqual(validateAvatarFile({ type: 'image/png', size: 2_000_000 }), { ok: true, error: '' });
});

test('rejects unsupported and oversized avatar files', () => {
  assert.match(validateAvatarFile({ type: 'image/gif', size: 100 }).error, /PNG, JPEG, or WebP/);
  assert.match(validateAvatarFile({ type: 'image/png', size: 9_000_000 }).error, /6 MB/);
});

test('calculates a centered square crop', () => {
  assert.deepEqual(avatarCrop(1200, 800), { sx: 200, sy: 0, size: 800 });
  assert.deepEqual(avatarCrop(600, 900), { sx: 0, sy: 150, size: 600 });
});
```

- [ ] **Step 2: Run the test and verify missing-module failure**

Run: `node --test tests/avatarImage.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement validation, crop, and browser processing**

```js
const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const OUTPUT_SIZE = 320;

export function validateAvatarFile(file = {}) {
  if (!SUPPORTED_TYPES.has(file.type)) return { ok: false, error: 'Choose a PNG, JPEG, or WebP image.' };
  if (Number(file.size || 0) > MAX_SOURCE_BYTES) return { ok: false, error: 'Choose an image smaller than 6 MB.' };
  return { ok: true, error: '' };
}

export function avatarCrop(width, height) {
  const size = Math.min(width, height);
  return { sx: (width - size) / 2, sy: (height - size) / 2, size };
}

export async function processAvatarFile(file, env = globalThis) {
  const validation = validateAvatarFile(file);
  if (!validation.ok) throw new Error(validation.error);
  const bitmap = await env.createImageBitmap(file);
  const canvas = env.document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const { sx, sy, size } = avatarCrop(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close?.();
  return { kind: 'custom', dataUrl: canvas.toDataURL('image/webp', 0.82), mimeType: 'image/webp' };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/avatarImage.test.mjs`

Expected: 3 tests PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/avatarImage.js tests/avatarImage.test.mjs
git commit -m "feat: add local avatar image processing"
```

## Task 5: Add Pure Wyth UI State Rules

**Files:**
- Create: `src/wythUiState.js`
- Create: `tests/wythUiState.test.mjs`

- [ ] **Step 1: Write failing state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginCompanionTransition,
  closeDrawer,
  createWythUiState,
  openDrawer,
  resolveMotionPreference,
  setHistoryReading
} from '../src/wythUiState.js';

test('opens one drawer section and records the focus return id', () => {
  assert.deepEqual(openDrawer(createWythUiState(), 'vocabulary', 'dockVocabulary'), {
    ...createWythUiState(), drawer: 'vocabulary', drawerReturnFocusId: 'dockVocabulary'
  });
  assert.equal(closeDrawer(openDrawer(createWythUiState(), 'profile', 'dockProfile')).drawer, '');
});

test('history reading is an automatic presentation state', () => {
  assert.equal(setHistoryReading(createWythUiState(), true).historyReading, true);
});

test('a new companion transition replaces an in-flight transition', () => {
  const first = beginCompanionTransition(createWythUiState(), 'a', 'b');
  const second = beginCompanionTransition(first, 'b', 'c');
  assert.equal(second.transition.toId, 'c');
  assert.ok(second.transition.token > first.transition.token);
});

test('explicit motion preference overrides the operating system', () => {
  assert.equal(resolveMotionPreference('reduce', false), true);
  assert.equal(resolveMotionPreference('full', true), false);
  assert.equal(resolveMotionPreference('', true), true);
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/wythUiState.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement immutable state helpers**

```js
export function createWythUiState() {
  return {
    drawer: '',
    drawerReturnFocusId: '',
    historyReading: false,
    motionPreference: '',
    transition: { token: 0, fromId: '', toId: '', phase: 'idle' }
  };
}

export function openDrawer(state, drawer, returnFocusId) {
  return { ...state, drawer, drawerReturnFocusId: returnFocusId || '' };
}

export function closeDrawer(state) { return { ...state, drawer: '' }; }
export function setHistoryReading(state, historyReading) { return { ...state, historyReading: Boolean(historyReading) }; }

export function beginCompanionTransition(state, fromId, toId) {
  return {
    ...state,
    transition: { token: state.transition.token + 1, fromId, toId, phase: 'leaving' }
  };
}

export function resolveMotionPreference(stored, systemReduce) {
  if (stored === 'reduce') return true;
  if (stored === 'full') return false;
  return Boolean(systemReduce);
}
```

- [ ] **Step 4: Run focused and full tests, then commit**

Run: `node --test tests/wythUiState.test.mjs`

Expected: 4 tests PASS.

Run: `npm test`

Expected: all tests PASS.

```powershell
git add -- src/wythUiState.js tests/wythUiState.test.mjs
git commit -m "feat: add Wyth interface state model"
```

## Task 6: Replace the Static HTML Shell and Rebrand to Wyth

**Files:**
- Modify: `index.html`
- Modify: `tests/layoutCss.test.mjs`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.mjs`

- [ ] **Step 1: Update structural tests before changing markup**

Replace the old three-column assertions with:

```js
test('Wyth shell exposes one cinematic chat viewport and hidden secondary surfaces', () => {
  assert.match(html, /class="wyth-shell"/);
  assert.match(html, /id="sceneStage"/);
  assert.match(html, /id="companionRail"/);
  assert.match(html, /id="utilityDock"/);
  assert.match(html, /id="utilityDrawer"/);
  assert.doesNotMatch(html, /class="studio-panel"/);
});

test('Wyth brand stays small in chat and preserves the registered full name in About', () => {
  assert.match(html, />Wyth</);
  assert.match(html, /with warmth/);
  assert.match(html, /Intelligent agents/);
});
```

Add i18n assertions:

```js
assert.equal(t('zh', 'firstUse.prompt'), '今天想和谁说说话？');
assert.equal(t('en', 'dock.vocabulary'), 'Vocabulary');
assert.equal(t('zh', 'settings.reduceMotion'), '减少动态效果');
```

- [ ] **Step 2: Run tests and verify structural failures**

Run: `node --test tests/layoutCss.test.mjs tests/i18n.test.mjs`

Expected: FAIL because the new shell and keys do not exist.

- [ ] **Step 3: Replace the body shell**

Use this top-level structure, keeping the existing detailed forms temporarily inside `#drawerContent` so behavior can be migrated incrementally:

```html
<div class="wyth-shell" id="wythShell">
  <aside class="companion-rail" id="companionRail" aria-label="Companions">
    <a class="wyth-mark" href="#chat" aria-label="Wyth home">
      <img src="assets/wyth/brand/wyth-wordmark.svg" alt="Wyth">
    </a>
    <div class="companion-list" id="companionList"></div>
    <button id="openCreateButton" class="rail-create" type="button" data-drawer="create" aria-label="Create companion">+</button>
  </aside>

  <main class="scene-stage" id="sceneStage" aria-label="Selected companion chat">
    <div class="scene-fallback" id="sceneFallback"></div>
    <img class="scene-base" id="sceneBase" alt="" decoding="async">
    <canvas class="scene-atmosphere" id="sceneAtmosphere" aria-hidden="true"></canvas>
    <div class="scene-continuity" aria-hidden="true"></div>
    <header class="chat-identity" id="chatHeader"></header>
    <section class="message-list" id="messageList" aria-live="polite"></section>
    <form class="composer" id="messageForm">
      <label class="sr-only" for="messageInput">Message</label>
      <input id="messageInput" type="text" autocomplete="off">
      <button type="submit" aria-label="Send message">Send</button>
    </form>
  </main>

  <nav class="utility-dock" id="utilityDock" aria-label="Wyth tools">
    <button id="dockCreate" type="button" data-drawer="create">Create</button>
    <button id="dockVocabulary" type="button" data-drawer="vocabulary">Vocabulary</button>
    <button id="dockProfile" type="button" data-drawer="profile">Profile</button>
    <button id="dockModel" type="button" data-drawer="model">Model</button>
    <button id="dockSettings" type="button" data-drawer="settings">Settings</button>
  </nav>

  <aside class="utility-drawer" id="utilityDrawer" hidden aria-labelledby="drawerTitle">
    <header><h2 id="drawerTitle"></h2><button id="closeDrawerButton" type="button">Close</button></header>
    <div id="drawerContent"></div>
  </aside>
</div>
```

Add a hidden About block inside the settings source markup containing `Wyth`, `with warmth`, and `Intelligent agents`.

- [ ] **Step 4: Add matching i18n keys in both languages**

Add the same keys to English and Chinese tables for `firstUse.*`, `dock.*`, `drawer.*`, `settings.reduceMotion`, `avatar.*`, and contextual language actions. Keep the key parity test passing.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/layoutCss.test.mjs tests/i18n.test.mjs`

Expected: structural and dictionary tests PASS; CSS-specific assertions added in the next task remain absent.

- [ ] **Step 6: Commit**

```powershell
git add -- index.html src/i18n.js tests/layoutCss.test.mjs tests/i18n.test.mjs
git commit -m "feat: replace app shell with Wyth viewport"
```

## Task 7: Build the Cinematic CSS Layout, Drawer, and Reading Mode

**Files:**
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add failing CSS contract tests**

```js
test('scene stage fills the viewport and keeps the composer anchored', () => {
  assert.match(declarationsFor('.wyth-shell'), /min-height:\s*100(?:dvh|vh)/);
  assert.match(declarationsFor('.scene-stage'), /overflow:\s*hidden/);
  assert.match(declarationsFor('.composer'), /position:\s*absolute/);
});

test('history reading mode creates a contrast-protected transcript', () => {
  assert.match(css, /\.scene-stage\.is-history-reading\s+\.message-list/);
  assert.match(css, /backdrop-filter:\s*blur/);
});

test('inactive companion avatars recover on hover and focus-visible', () => {
  assert.match(css, /\.companion-card:not\(\.active\)/);
  assert.match(css, /\.companion-card:focus-visible/);
});

test('reduced motion and mobile bottom sheet are defined', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /\.utility-drawer/);
});
```

- [ ] **Step 2: Run and verify CSS failures**

Run: `node --test tests/layoutCss.test.mjs`

Expected: FAIL for missing Wyth CSS declarations.

- [ ] **Step 3: Replace generic template CSS with Wyth tokens and layout**

Start with explicit tokens and shell geometry:

```css
:root {
  --wyth-ink: #f6f1e8;
  --wyth-ink-dark: #18201f;
  --wyth-muted: rgba(246, 241, 232, 0.68);
  --wyth-warm: #d5aa78;
  --wyth-surface: rgba(22, 27, 27, 0.68);
  --wyth-reading: rgba(239, 235, 225, 0.88);
  --wyth-line: rgba(255, 255, 255, 0.16);
  --wyth-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.wyth-shell { position: relative; min-height: 100dvh; overflow: hidden; background: #17201f; }
.scene-stage { position: relative; min-height: 100dvh; overflow: hidden; isolation: isolate; }
.scene-base, .scene-fallback, .scene-atmosphere { position: absolute; inset: 0; width: 100%; height: 100%; }
.scene-base { object-fit: cover; transition: transform 720ms var(--wyth-ease), opacity 420ms ease; }
.companion-rail { position: fixed; z-index: 20; inset: 0 auto 0 0; width: 76px; }
.utility-dock { position: fixed; z-index: 22; left: 50%; bottom: 18px; transform: translateX(-50%); }
.utility-drawer { position: fixed; z-index: 30; inset: 12px 12px 12px auto; width: min(420px, calc(100vw - 24px)); }
.composer { position: absolute; z-index: 12; left: 50%; bottom: 28px; transform: translateX(-50%); width: min(720px, calc(100vw - 220px)); }
```

Add readable message bubbles without making every message a glass card. Add `is-history-reading`, `is-drawer-open`, `is-transitioning`, and `reduce-motion` state selectors. Add a mobile avatar strip and bottom sheet under 760px.

- [ ] **Step 4: Add keyboard, contrast, and reduced-motion rules**

```css
:where(button, input, select, [tabindex]):focus-visible { outline: 2px solid #f4c991; outline-offset: 3px; }
.companion-card:not(.active) { opacity: 0.28; }
.companion-card:hover, .companion-card:focus-visible { opacity: 1; }
.scene-stage.is-history-reading .message-list { background: var(--wyth-reading); color: var(--wyth-ink-dark); backdrop-filter: blur(18px); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 1ms !important; }
}
```

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/layoutCss.test.mjs`

Expected: all layout tests PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- styles.css tests/layoutCss.test.mjs
git commit -m "feat: add Wyth cinematic layout styles"
```

## Task 8: Wire Scenes, Companion Rail, History Reading, and Interruptible Switching

**Files:**
- Modify: `src/app.js`
- Modify: `src/chatUiState.js`
- Modify: `tests/chatUiState.test.mjs`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add a failing message action test**

```js
import { createMessageActions } from '../src/chatUiState.js';

test('message actions expose only user-invoked language help', () => {
  assert.deepEqual(createMessageActions({ role: 'user' }), [
    { action: 'translate', labelKey: 'message.translate' },
    { action: 'rewrite', labelKey: 'message.rewrite' },
    { action: 'speak', labelKey: 'message.speak' },
    { action: 'save-vocab', labelKey: 'message.saveVocab' }
  ]);
});
```

- [ ] **Step 2: Run and verify the missing export**

Run: `node --test tests/chatUiState.test.mjs`

Expected: FAIL because `createMessageActions` is not exported.

- [ ] **Step 3: Implement message action descriptors**

```js
export function createMessageActions(message = {}) {
  if (!['user', 'assistant'].includes(message.role)) return [];
  return [
    { action: 'translate', labelKey: 'message.translate' },
    { action: 'rewrite', labelKey: 'message.rewrite' },
    { action: 'speak', labelKey: 'message.speak' },
    { action: 'save-vocab', labelKey: 'message.saveVocab' }
  ];
}
```

- [ ] **Step 4: Import the new modules and initialize UI state**

In `src/app.js`, import `sceneForId`, avatar helpers, and Wyth UI-state helpers. Add:

```js
const MOTION_KEY = 'wyth-motion-preference';
let wythUiState = {
  ...createWythUiState(),
  motionPreference: localStorage.getItem(MOTION_KEY) || ''
};
```

Replace old dialog/studio element references with `sceneStage`, `sceneBase`, `sceneFallback`, `sceneAtmosphere`, `utilityDock`, `utilityDrawer`, `drawerTitle`, `drawerContent`, and `closeDrawerButton`.

- [ ] **Step 5: Render approved scenes and avatars**

Add focused helpers:

```js
function companionAvatarSrc(companion) {
  return companion.avatar?.kind === 'custom'
    ? companion.avatar.dataUrl
    : sceneForId(companion.sceneId).avatarAsset;
}

function renderScene(companion) {
  const scene = sceneForId(companion.sceneId);
  els.sceneBase.src = scene.baseAsset;
  els.sceneBase.dataset.sceneId = scene.id;
  els.sceneFallback.style.background = `linear-gradient(145deg, ${scene.fallback.colors.join(', ')})`;
  els.sceneStage.dataset.ambientEffect = scene.ambientEffect;
}
```

The scene image `error` handler must hide the broken image and leave the palette fallback visible. The `load` handler restores it.

- [ ] **Step 6: Replace companion cards with the fading avatar rail**

Render each companion as a button containing the approved/default or custom avatar, accessible name, unread badge, active marker, and hover/focus label. Preserve unread and selected-companion logic.

- [ ] **Step 7: Make companion transitions token-based and interruptible**

Change `selectCompanion(id)` to:

```js
async function selectCompanion(id) {
  const current = activeCompanion();
  if (!id || id === current?.id) return;
  wythUiState = beginCompanionTransition(wythUiState, current?.id || '', id);
  const token = wythUiState.transition.token;
  syncShellState();
  if (!motionReduced()) await waitForTransition(260);
  if (wythUiState.transition.token !== token) return;
  state.selectedCompanionId = id;
  readReceipts = markCompanionRead(readReceipts, id);
  saveState();
  saveReadReceipts();
  render();
  wythUiState = { ...wythUiState, transition: { ...wythUiState.transition, phase: 'idle' } };
  syncShellState();
  refreshMemoryStatus(id);
}
```

`waitForTransition()` uses a short `setTimeout` promise; reduced motion skips it. Do not persist transition state.

- [ ] **Step 8: Detect history-reading state from transcript scroll**

On `messageList` scroll, compare `scrollHeight - scrollTop - clientHeight` to 80px. Set history mode when above the threshold and call `syncShellState()`. Stop forcing `scrollTop = scrollHeight` during ordinary rerenders; only scroll on initial companion load or after sending/receiving a new message while the user is already near the bottom.

- [ ] **Step 9: Run tests and manually verify the shell loads**

Run: `node --test tests/chatUiState.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Start: `npm run dev`

Expected: Wyth loads at `http://127.0.0.1:5173`; companion switching works; missing scene assets fall back without breaking chat.

- [ ] **Step 10: Commit**

```powershell
git add -- src/app.js src/chatUiState.js tests/chatUiState.test.mjs tests/layoutCss.test.mjs
git commit -m "feat: connect Wyth scenes and companion transitions"
```

## Task 9: Move Existing Studio Features into the Utility Drawer

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add a failing structural action test**

```js
test('utility drawer preserves every existing secondary capability', () => {
  for (const action of ['daily-pick', 'run-scheduler', 'clear-memory', 'edit-companion', 'delete-companion']) {
    assert.match(appJs, new RegExp(`data-action="${action}"`));
  }
  for (const drawer of ['create', 'vocabulary', 'profile', 'model', 'settings']) {
    assert.match(html, new RegExp(`data-drawer="${drawer}"`));
  }
});
```

- [ ] **Step 2: Run and verify failure for the new drawer structure**

Run: `node --test tests/layoutCss.test.mjs`

Expected: FAIL until all drawer sections are rendered.

- [ ] **Step 3: Split the old `renderStudio()` output into drawer renderers**

Create these functions inside `app.js` and move existing markup/handlers without changing their underlying behavior:

```js
function renderDrawerContent(section, companion) {
  const renderers = {
    create: () => renderCompanionEditor(companion),
    vocabulary: () => renderVocabularyDrawer(),
    profile: () => renderProfileDrawer(),
    model: () => renderModelDrawer(),
    settings: () => renderSettingsDrawer(companion)
  };
  return (renderers[section] || (() => ''))();
}
```

`renderSettingsDrawer()` contains notification, scheduler, Daily Picks, memory, content preferences, interface language, reduced motion, About, edit, and delete controls. `renderModelDrawer()` reuses `renderModelSettings()`. `renderVocabularyDrawer()` reuses the existing word list and removal actions.

- [ ] **Step 4: Wire dock click, Escape, focus containment, and focus restoration**

When a dock button opens a drawer, store its ID in `wythUiState.drawerReturnFocusId`. While open, Tab/Shift+Tab cycle within the drawer. On close, restore focus to the stored element. Escape closes the drawer before it closes translation surfaces.

- [ ] **Step 5: Preserve existing delegated actions**

Move the `studioPanel` delegated click handler to `utilityDrawer`. Keep every action branch, including memory deletion, notification preferences, Daily Picks, model form submit, category changes, vocabulary removal, and profile update.

- [ ] **Step 6: Run focused/full tests and smoke test each drawer**

Run: `node --test tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual check: open and close each dock item; edit a profile; open model settings; clear memory only after the existing confirmation path; return to chat without losing scroll or composer text.

- [ ] **Step 7: Commit**

```powershell
git add -- src/app.js index.html tests/layoutCss.test.mjs
git commit -m "feat: move Wyth tools into the utility drawer"
```

## Task 10: Build the First-Use Preset and Progressive Companion Creation Flow

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`
- Modify: `tests/companionLogic.test.mjs`

- [ ] **Step 1: Add failing first-use assertions**

```js
test('first-use experience offers the approved prompt and five presets', () => {
  assert.match(appJs, /firstUse\.prompt/);
  assert.match(appJs, /WYTH_PRESETS/);
  assert.match(appJs, /data-preset-id/);
});
```

Add a companion test that creates a companion from each preset and verifies scene, support mode, language, and correction mode.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/layoutCss.test.mjs tests/companionLogic.test.mjs`

Expected: FAIL because preset rendering is not connected.

- [ ] **Step 3: Render first-use only when no companions exist**

Add `renderFirstUse()` with the approved prompt and five preset buttons. Do not delete the five seed presets for existing users; expose a development/reset path through settings if needed for verification. A new installation should start from an empty state plus presets rather than automatically adding all five companions.

Change the no-storage path in `loadState()` to return:

```js
return { user: createSeedState().user, selectedCompanionId: '', companions: [], messages: [] };
```

Keep `createSeedState()` for deterministic tests and recovery from corrupt data.

- [ ] **Step 4: Add preset selection behavior**

Selecting a preset creates a real editable companion from the preset, creates its welcome message, selects it, persists state, and enters the matching approved scene.

- [ ] **Step 5: Convert the creation form into four visible steps**

Use `data-create-step="identity|preferences|scene|avatar|preview"` sections. Back/Next buttons update only local draft state. The scene step calls `recommendSceneId(draft)` and displays catalog alternatives. Submission occurs only from Preview.

- [ ] **Step 6: Run focused/full tests and first-use smoke test**

Run: `node --test tests/layoutCss.test.mjs tests/companionLogic.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual check in a clean localStorage profile: prompt appears; every preset can be previewed; selecting one starts chat; custom creation can move backward and forward without losing draft values.

- [ ] **Step 7: Commit**

```powershell
git add -- src/app.js index.html styles.css tests/layoutCss.test.mjs tests/companionLogic.test.mjs
git commit -m "feat: add Wyth first-use companion flow"
```

## Task 11: Integrate Avatar Upload, Replacement, Removal, and Storage Errors

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/i18n.js`
- Modify: `tests/layoutCss.test.mjs`
- Modify: `tests/i18n.test.mjs`

- [ ] **Step 1: Add failing markup and copy assertions**

```js
test('companion editor exposes local avatar upload and removal controls', () => {
  assert.match(html, /name="avatarFile"/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(appJs, /processAvatarFile/);
  assert.match(appJs, /data-action="remove-avatar"/);
});
```

Add i18n expectations for invalid type, file too large, storage full, replace avatar, and remove avatar.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/layoutCss.test.mjs tests/i18n.test.mjs`

Expected: FAIL for missing controls and keys.

- [ ] **Step 3: Add upload UI to the avatar creation step**

```html
<label class="avatar-upload">
  <span data-i18n="avatar.choose">Choose avatar</span>
  <input name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp">
</label>
<button type="button" data-action="remove-avatar" data-i18n="avatar.remove">Remove avatar</button>
<p id="avatarError" role="alert"></p>
```

- [ ] **Step 4: Process without destroying the previous avatar on failure**

On file selection, keep `previousAvatar`, call `processAvatarFile()`, and update the draft only after success. Wrap `saveState()` in a `try/catch` that recognizes localStorage quota errors; on failure, restore `previousAvatar`, rerender the preview, and show the localized storage message.

- [ ] **Step 5: Remove and restore default avatar**

The remove action sets `{ kind: 'default', dataUrl: '', mimeType: '' }`; the rail and preview immediately use `sceneForId(sceneId).avatarAsset`.

- [ ] **Step 6: Run focused/full tests and manual upload checks**

Run: `node --test tests/avatarImage.test.mjs tests/layoutCss.test.mjs tests/i18n.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual check: PNG, JPEG, WebP succeed; GIF and oversized files display errors; replacing/removing works after reload; no network request occurs when choosing an avatar.

- [ ] **Step 7: Commit**

```powershell
git add -- src/app.js index.html styles.css src/i18n.js tests/layoutCss.test.mjs tests/i18n.test.mjs
git commit -m "feat: add local companion avatar uploads"
```

## Task 12: Add Explicit "Say This More Naturally" Assistance

**Files:**
- Create: `src/languageAssistProxy.js`
- Create: `tests/languageAssistProxy.test.mjs`
- Modify: `server.mjs`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Write failing proxy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRewriteMessages,
  createLanguageAssistProxyHandler,
  parseRewritePayload
} from '../src/languageAssistProxy.js';

test('builds an explicit rewrite prompt without unsolicited correction', () => {
  const messages = buildRewriteMessages({ text: 'I very like it', targetLanguage: 'English' });
  assert.match(messages[0].content, /user explicitly asked/);
  assert.match(messages[1].content, /I very like it/);
});

test('parses a compact natural rewrite payload', () => {
  assert.deepEqual(parseRewritePayload('{"rewrite":"I really like it.","note":"Use really before like."}'), {
    rewrite: 'I really like it.', note: 'Use really before like.'
  });
});

test('returns a deterministic unavailable fallback without changing chat', async () => {
  const handler = createLanguageAssistProxyHandler();
  const response = await handler(new Request('http://local/api/language-assist', {
    method: 'POST', body: JSON.stringify({ text: 'hello', targetLanguage: 'English' })
  }));
  assert.equal((await response.json()).source, 'local_fallback');
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/languageAssistProxy.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the handler using the translate-proxy pattern**

The module validates POST input, caps text at 280 characters, builds an OpenAI-compatible message pair, parses only `{ rewrite, note }`, and returns a deterministic local fallback. Reuse the same `llmClientProvider` injection pattern as `translateProxy.js`.

- [ ] **Step 4: Register `/api/language-assist`**

In `server.mjs`, construct the handler beside `translateProxy` and route POST requests beginning with `/api/language-assist`. Do not change the chat or translate routes.

- [ ] **Step 5: Replace the single Translate trigger with a contextual action menu**

After selection or from a message's action button, show Translate, Say naturally, Read aloud, and Save vocabulary. Only the chosen action runs. Rewrite results appear in the existing popover surface and never append a correction message to chat.

- [ ] **Step 6: Run focused/full tests and manual action checks**

Run: `node --test tests/languageAssistProxy.test.mjs tests/translateProxy.test.mjs tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual check: ordinary messages cause no correction UI; explicit rewrite returns a contextual card; closing it leaves transcript unchanged.

- [ ] **Step 7: Commit**

```powershell
git add -- src/languageAssistProxy.js tests/languageAssistProxy.test.mjs server.mjs src/app.js tests/layoutCss.test.mjs
git commit -m "feat: add on-demand natural language assistance"
```

## Task 13: Add Ambient Canvas Effects and Reply Feedback

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add static contracts for effect shutdown**

```js
test('ambient effects stop for reduced motion and inactive scenes', () => {
  assert.match(appJs, /cancelAnimationFrame/);
  assert.match(appJs, /motionReduced\(\)/);
  assert.match(appJs, /document\.visibilityState/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/layoutCss.test.mjs`

Expected: FAIL because Canvas lifecycle management is absent.

- [ ] **Step 3: Implement one lightweight atmosphere controller**

Keep one `requestAnimationFrame` loop for the active scene only. Cap particles at 24 on desktop and 8 on narrow screens. Pause when the document is hidden, a drawer is open, history-reading mode is active, or reduced motion is enabled. Reinitialize on scene changes.

```js
function shouldAnimateScene() {
  return !motionReduced()
    && document.visibilityState === 'visible'
    && !wythUiState.historyReading
    && !wythUiState.drawer;
}
```

- [ ] **Step 4: Trigger restrained reply feedback**

Use the existing reply metadata emotion only to choose an atmospheric modifier class such as `mood-soft`, `mood-bright`, or `mood-still`. Do not label or diagnose the emotion in the chat scene. Remove the modifier after 1800ms and cancel the old timer when a new reply arrives.

- [ ] **Step 5: Add performance measurement fallback**

Track a rolling average of Canvas frame time. If it exceeds 28ms for 20 frames, halve the particle count once for the session. Do not branch on user-agent strings.

- [ ] **Step 6: Run tests and manual performance check**

Run: `node --test tests/layoutCss.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Manual check: switching scenes cancels the previous loop; reduced motion produces no Canvas loop; drawer/history mode pauses it; chat remains responsive.

- [ ] **Step 7: Commit**

```powershell
git add -- src/app.js styles.css tests/layoutCss.test.mjs
git commit -m "feat: add restrained Wyth ambient motion"
```

## Task 14: Complete Static Asset Serving, Responsive Behavior, and Accessibility

**Files:**
- Modify: `server.mjs`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/layoutCss.test.mjs`

- [ ] **Step 1: Add failing MIME and accessibility assertions**

Add a server test or existing server static-map assertion for:

```js
assert.equal(mimeTypes['.webp'], 'image/webp');
assert.equal(mimeTypes['.avif'], 'image/avif');
assert.equal(mimeTypes['.svg'], 'image/svg+xml');
```

Add structural assertions for `aria-current`, drawer `aria-expanded`, live upload errors, and a screen-reader companion-change announcement node.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `node --test tests/layoutCss.test.mjs`

Expected: FAIL for missing accessibility contracts or MIME entries.

- [ ] **Step 3: Add MIME types and responsive image loading**

Add WebP, AVIF, and SVG to the server MIME map. Scene images use `decoding="async"`; preload the active scene and one adjacent scene through `new Image()` only after the active image loads.

- [ ] **Step 4: Finish mobile interactions**

At 760px and below:

- Convert the role rail into a top horizontal strip.
- Convert the drawer into a bottom sheet capped at `82dvh`.
- Keep the composer above the virtual keyboard using `window.visualViewport` when available.
- Use a short crossfade for scene switching.
- Use no more than eight ambient particles.

- [ ] **Step 5: Finish accessibility state synchronization**

Set `aria-current="true"` on the active companion, update dock `aria-expanded`, announce companion changes through a visually hidden `aria-live="polite"` node, and ensure decorative scene images have empty alt text. Focus/focus-visible must reveal the same labels as hover.

- [ ] **Step 6: Run full tests and browser accessibility checks**

Run: `npm test`

Expected: all tests PASS.

Manual keyboard check: reach every avatar and dock action; open/close drawer; focus returns correctly; Escape order is contextual action -> drawer -> nothing; reduced motion keeps all functions.

- [ ] **Step 7: Commit**

```powershell
git add -- server.mjs styles.css src/app.js tests/layoutCss.test.mjs
git commit -m "feat: complete Wyth responsive accessibility"
```

## Task 15: Update Product Metadata and Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`

- [ ] **Step 1: Update package metadata without changing commands**

```json
{
  "name": "wyth",
  "description": "Wyth is a local-first warm AI companion chat app with optional on-demand language tools."
}
```

Keep the existing version, scripts, license, repository, type, and private fields.

- [ ] **Step 2: Rewrite the user-facing overview**

README must describe Wyth, `with warmth`, the companion-first priority, five presets, local avatar uploads, optional language actions, scene fallback, reduced motion, and the unchanged start/test commands.

- [ ] **Step 3: Update the developer map**

Add `sceneCatalog.js`, `avatarImage.js`, `wythUiState.js`, `languageAssistProxy.js`, `assets/wyth/`, the `/api/language-assist` route, migration behavior, and asset approval rule. Update the `app.js` section to describe its new orchestration boundaries.

- [ ] **Step 4: Verify documentation commands**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run dev`

Expected: server starts on `http://127.0.0.1:5173` with the documented command.

- [ ] **Step 5: Commit**

```powershell
git add -- package.json README.md DEVELOPMENT.md
git commit -m "docs: rebrand project documentation to Wyth"
```

## Task 16: Final Visual, Behavioral, and Regression Verification

**Files:**
- Modify only if verification reveals a defect: the exact affected source and test files
- Review: `docs/wyth/visual-asset-approval.md`

- [ ] **Step 1: Run formatting and repository checks**

Run:

```powershell
git diff --check
npm test
```

Expected: no whitespace errors; the complete test suite passes.

- [ ] **Step 2: Verify desktop scenarios**

At representative 1440x900 and 1024x768 sizes, verify:

- First-use prompt and five presets.
- Every approved scene and default avatar.
- Custom avatar create/replace/remove/reload.
- Companion hover fade and keyboard focus behavior.
- Interruptible companion switching.
- Long transcript entering and leaving reading mode.
- Every utility drawer section.
- Chat, model fallback, memory, Daily Picks, scheduler, translation, rewrite, speech, and vocabulary.

- [ ] **Step 3: Verify reduced motion and failures**

Verify stored Reduce motion and OS `prefers-reduced-motion`. Temporarily rename one local scene asset to confirm the palette fallback, then restore the asset immediately. Test invalid avatar input and simulated quota failure without losing the previous avatar.

- [ ] **Step 4: Verify mobile core behavior**

At 390x844, verify horizontal avatar strip, bottom sheet, composer/keyboard positioning, scene crossfade, message readability, contextual language actions, and touch target sizing.

- [ ] **Step 5: Compare shipped visuals to the approval manifest**

Every image referenced by `src/sceneCatalog.js`, `index.html`, or `styles.css` must appear as approved in `docs/wyth/visual-asset-approval.md`. Remove any unapproved or unused shipped candidate.

- [ ] **Step 6: Review final diff scope**

Run:

```powershell
git status --short
git log --oneline --max-count=20
```

Expected: only intentional Wyth changes remain; unrelated pre-existing user changes are preserved; implementation is represented by focused commits.

- [ ] **Step 7: Create the final verification commit only if fixes were needed**

```powershell
git add -- <only-the-files-fixed-during-verification>
git commit -m "fix: resolve Wyth verification findings"
```

If no fixes were required, do not create an empty commit.

