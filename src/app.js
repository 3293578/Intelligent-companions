import {
  buildContentRetrievalPlan,
  CATEGORY_LIBRARY,
  LANGUAGE_LIBRARY,
  buildWelcomeContent,
  companionsDueForPush,
  createAssistantReply,
  createCompanion,
  createDailyPush,
  createEmptyState,
  createSeedState,
  createUserMessage,
  deserializeState,
  generateCompanionPreview,
  previewNotification,
  runScheduledDailyPushes,
  hasSchedulerStateChanged,
  serializeState,
  stopPushCategory,
  updateCompanion,
  updateUserProfile,
  updateMemory
} from './companionLogic.js';
import {
  beginChatSend,
  buildRenderableMessages,
  canSendChatMessage,
  chatFailureMessageKey,
  completeChatSend,
  countUnreadCompanionMessages,
  createDailyPushActions,
  markCompanionRead,
  tagAssistantReplySource
} from './chatUiState.js';
import { retrieveContentForCompanion } from './contentAdapters.js';
import {
  addVocabEntry,
  deserializeVocabBook,
  removeVocabEntry,
  serializeVocabBook
} from './vocabBook.js';
import { processAvatarFile } from './avatarImage.js';
import { WYTH_PRESETS, sceneForId } from './sceneCatalog.js';
import { resolveAmbientDescriptor, resolveSceneTime } from './scenePresentation.js';
import {
  assessSupportSignal,
  requestManualSupport,
  resolveSupportPresence
} from './emotionSupport.js';
import {
  beginCompanionTransition,
  completeCompanionTransition,
  createWythUiState,
  setHistoryReading,
  setReadingMode,
  setSupportPresence
} from './wythUiState.js';
import {
  FULL_SETTINGS_SECTIONS,
  closeSettings,
  createSettingsState,
  openFullSettings,
  openQuickSettings,
  persistQuickSettings,
  selectFullSettingsSection,
  updateQuickSetting
} from './settingsState.js';
import {
  loadNotificationPreferences,
  normalizeNotificationPreferences,
  saveNotificationPreferences
} from './notificationPreferences.js';
import {
  ID_TO_TRANSLATION_KEY,
  WYTH_LOCALES,
  normalizeLocale,
  t
} from './wythI18n.js';
import {
  createOnboardingState,
  deserializeOnboardingState,
  normalizeBirthday,
  saveBirthday,
  selectOnboardingPath,
  setInterfaceLocale
} from './onboardingState.js';
import {
  captureTranscriptView,
  normalizeRelationshipForAge as normalizeRelationshipForAgeState,
  persistInterfaceState,
  restoreTranscriptView
} from './interfaceUiState.js';
import {
  ADVANCED_STEPS,
  createCreationFlow,
  canSubmitCreation,
  acceptsAvatarRequest,
  beginAvatarRequest,
  goToCreationStep,
  selectVisualStyle,
  validateCreationStep,
  updateCreationDraft
} from './creationFlowState.js';
import { formatChatTimestamp } from './chatTime.js';
import { authErrorKey, authenticatedStatusFromLogin, createAuthUiState, parseAuthCallback, reduceAuthState } from './authBrowser.js';
import { accountStorageKey, migrateGuestStorage } from './accountStorage.js';

const STORAGE_KEY = 'english-companions-state-v1';
const MOTION_KEY = 'wyth-reduce-motion';
const ONBOARDING_KEY = 'wyth-onboarding-v1';
const SETTINGS_KEY = 'wyth-settings-v1';
const NOTIFICATIONS_KEY = 'wyth-notifications-v1';
const ACCOUNT_STORAGE_KEYS = Object.freeze([
  STORAGE_KEY,
  ONBOARDING_KEY,
  SETTINGS_KEY,
  NOTIFICATIONS_KEY,
  `${STORAGE_KEY}-read-receipts`,
  `${STORAGE_KEY}-saved-picks`,
  `${STORAGE_KEY}-vocab-book`
]);
let storageOwnerId = '';

function ownedStorageKey(baseKey) {
  return accountStorageKey(baseKey, storageOwnerId);
}

const els = {
  companionList: document.querySelector('#companionList'),
  chatHeader: document.querySelector('#chatHeader'),
  messageList: document.querySelector('#messageList'),
  messageForm: document.querySelector('#messageForm'),
  messageInput: document.querySelector('#messageInput'),
  companionPresence: document.querySelector('#companionPresence'),
  supportPresenceVisual: document.querySelector('#supportPresenceVisual'),
  supportPresenceTitle: document.querySelector('#supportPresenceTitle'),
  supportPresenceMessage: document.querySelector('#supportPresenceMessage'),
  studioPanel: document.querySelector('#studioPanel'),
  openCreateButton: document.querySelector('#openCreateButton'),
  createDialog: document.querySelector('#createDialog'),
  closeCreateButton: document.querySelector('#closeCreateButton'),
  cancelCreateButton: document.querySelector('#cancelCreateButton'),
  createForm: document.querySelector('#createForm'),
  categoryFields: document.querySelector('#categoryFields'),
  saveCompanionButton: document.querySelector('#saveCompanionButton'),
  companionPreview: document.querySelector('#companionPreview')
  ,
  quickCreation: document.querySelector('#quickCreation'),
  advancedCreation: document.querySelector('#advancedCreation'),
  creationStepper: document.querySelector('#creationStepper'),
  creationStepHeading: document.querySelector('#creationStepHeading'),
  creationError: document.querySelector('#creationError'),
  creationReview: document.querySelector('#creationReview'),
  creationPreviewPanel: document.querySelector('#creationPreviewPanel'),
  advancedAvatarPreview: document.querySelector('#advancedAvatarPreview'),
  advancedAvatarError: document.querySelector('#advancedAvatarError'),
  currentVisualStatus: document.querySelector('#currentVisualStatus'),
  currentVoiceStatus: document.querySelector('#currentVoiceStatus'),
  openProfileButton: document.querySelector('#openProfileButton'),
  profileDialog: document.querySelector('#profileDialog'),
  profileForm: document.querySelector('#profileForm'),
  closeProfileButton: document.querySelector('#closeProfileButton'),
  cancelProfileButton: document.querySelector('#cancelProfileButton'),
  translateTrigger: document.querySelector('#translateTrigger'),
  translatePopover: document.querySelector('#translatePopover'),
  sceneCurrent: document.querySelector('#sceneCurrent'),
  sceneOutgoing: document.querySelector('#sceneOutgoing'),
  utilityDrawer: document.querySelector('#utilityDrawer'),
  utilityDock: document.querySelector('#utilityDock'),
  closeDrawerButton: document.querySelector('#closeDrawerButton'),
  drawerTitle: document.querySelector('#drawerTitle'),
  avatarError: document.querySelector('#avatarError'),
  avatarPreview: document.querySelector('#avatarPreview')
  ,
  firstUse: document.querySelector('#firstUse'),
  sceneAtmosphere: document.querySelector('#sceneAtmosphere'),
  interfaceLanguageSwitch: document.querySelector('#interfaceLanguageSwitch'),
  onboardingBirthdayForm: document.querySelector('#onboardingBirthdayForm'),
  onboardingBirthday: document.querySelector('#onboardingBirthday'),
  birthdayError: document.querySelector('#birthdayError'),
  onboardingPresetList: document.querySelector('#onboardingPresetList'),
  profileBirthday: document.querySelector('#profileBirthday'),
  profileBirthdayError: document.querySelector('#profileBirthdayError'),
  onboardingStorageError: document.querySelector('#onboardingStorageError')
  ,
  fullSettings: document.querySelector('#fullSettings'),
  fullSettingsNav: document.querySelector('#fullSettingsNav'),
  fullSettingsContent: document.querySelector('#fullSettingsContent'),
  closeFullSettingsButton: document.querySelector('#closeFullSettingsButton')
};

let state = loadState();
let onboarding = loadOnboardingState();
reconcileInterfaceLocale();
let editingCompanionId = null;
let creationFlow = createCreationFlow();
let creationPresetId = 'friend';
let avatarRequestState = { session: 0, token: 0 };
let notificationPreferences = loadOwnedNotificationPreferences();
let schedulerStatus = {
  lastRunAt: null,
  lastNotifications: [],
  lastSourceMode: 'mock'
};
let runtimeStatus = {
  llm: {
    configured: false,
    provider: 'deepseek',
    label: 'DeepSeek',
    model: 'local fallback',
    baseUrl: '',
    apiMode: '',
    keyEnv: 'DEEPSEEK_API_KEY',
    lastChatSource: null,
    lastChatAt: null
  },
  modelOptions: {}
};
let modelSettingsState = {
  saving: false,
  errorKey: '',
  savedAt: null
};
let authUiState = createAuthUiState();
let authFormEmail = '';
let authInvalidField = '';
let backendMemoryStatus = {};
let chatUiState = {
  pendingCompanionId: null,
  error: ''
};
let readReceipts = loadReadReceipts();
let savedPicks = loadSavedPicks();
let vocabBook = loadVocabBook();
let pendingSelection = null;
let activeTranslation = null;
let activeSupportSignal = null;
let supportTrigger = null;
let ignoreSelectionUntilPointerUp = false;
let activeDrawer = '';
let pendingAvatar = null;
let drawerTrigger = null;
let profilePromptDismissed = false;
let interfaceStorageErrorKey = '';
let reduceMotion = localStorage.getItem(MOTION_KEY) === 'true';
let wythUiState = createWythUiState();
let settingsState = loadSettingsState();
let settingsView = null;
let notificationPermissionPending = false;
let sceneCleanupTimer = 0;
let atmosphereFrame = 0;
let atmosphereParticles = [];

document.documentElement.classList.toggle('reduce-motion', reduceMotion);
wythUiState = setReadingMode(wythUiState, settingsState.quick.readingMode);

function localCalendarDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadOnboardingState() {
  const now = localCalendarDate();
  try {
    const raw = localStorage.getItem(ownedStorageKey(ONBOARDING_KEY));
    if (raw) {
      const restored = deserializeOnboardingState(raw, now);
      if (state.companions.length > 0) return { ...restored, stage: 'complete', completed: true };
      return restored;
    }
  } catch {
    // A storage failure must not block an existing conversation.
  }

  const hasExistingCompanions = state.companions.length > 0;
  let next = createOnboardingState({
    interfaceLocale: state.user.interfaceLocale,
    stage: hasExistingCompanions ? 'complete' : 'welcome',
    completed: hasExistingCompanions
  });
  if (state.user.birthday) next = saveBirthday(next, state.user.birthday, now);
  if (hasExistingCompanions) next = { ...next, stage: 'complete', completed: true };
  return next;
}

function persistNextInterfaceState(nextOnboarding, nextState) {
  const result = persistInterfaceState(localStorage, {
    onboardingKey: ownedStorageKey(ONBOARDING_KEY),
    onboardingValue: JSON.stringify(nextOnboarding),
    stateKey: ownedStorageKey(STORAGE_KEY),
    stateValue: serializeState(nextState)
  });
  interfaceStorageErrorKey = result.ok ? '' : 'error.storageUnavailable';
  if (els.onboardingStorageError) {
    els.onboardingStorageError.textContent = interfaceStorageErrorKey ? tr(interfaceStorageErrorKey) : '';
  }
  if (!result.ok) return false;
  onboarding = nextOnboarding;
  state = nextState;
  return true;
}

function saveOnboardingState() {
  return persistNextInterfaceState(onboarding, state);
}

function reconcileInterfaceLocale() {
  const locale = normalizeLocale(onboarding.interfaceLocale || state.user.interfaceLocale);
  if (onboarding.interfaceLocale === locale && state.user.interfaceLocale === locale) return;
  const nextOnboarding = { ...onboarding, interfaceLocale: locale };
  const nextState = { ...state, user: updateUserProfile(state.user, { interfaceLocale: locale }) };
  persistNextInterfaceState(nextOnboarding, nextState);
}

function tr(key, values) {
  return t(onboarding.interfaceLocale, key, values);
}

function applyTranslatedAttributes(root = document) {
  const attributes = [
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-title', 'title']
  ];
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = tr(node.dataset.i18n);
  });
  for (const [dataAttribute, attribute] of attributes) {
    root.querySelectorAll(`[${dataAttribute}]`).forEach((node) => {
      const key = node.getAttribute(dataAttribute);
      if (key) node.setAttribute(attribute, tr(key));
    });
  }
}

function applyInterfaceLocale({ rerender = false } = {}) {
  const locale = normalizeLocale(onboarding.interfaceLocale);
  document.documentElement.lang = WYTH_LOCALES[locale].meta.htmlLang;
  document.title = tr('brand.windowTitle');
  applyTranslatedAttributes();
  els.firstUse.querySelectorAll('[data-locale]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.locale === locale));
  });
  if (activeDrawer) {
    els.drawerTitle.textContent = tr(activeDrawer === 'vocabulary' ? 'vocabulary.title' : 'settings.title');
  }
  if (rerender) render({ preserveView: true });
}

function changeInterfaceLocale(locale, source) {
  const nextOnboarding = setInterfaceLocale(onboarding, locale);
  const nextState = { ...state, user: updateUserProfile(state.user, { interfaceLocale: nextOnboarding.interfaceLocale }) };
  if (!persistNextInterfaceState(nextOnboarding, nextState)) {
    render({ preserveView: true });
    return;
  }
  commitSettingsState(updateQuickSetting(settingsState, 'interfaceLocale', nextOnboarding.interfaceLocale));
  hideTranslateTrigger();
  hideTranslatePopover();
  pendingSelection = null;
  activeTranslation = null;
  applyInterfaceLocale({ rerender: true });
  requestAnimationFrame(() => {
    if (source === 'firstUse' && onboarding.stage === 'birthday') {
      els.firstUse.querySelector('[data-onboarding-stage="birthday"]')?.focus();
      return;
    }
    const selector = `[data-locale="${onboarding.interfaceLocale}"]`;
    const button = source === 'drawer' && activeDrawer === 'settings'
      ? els.studioPanel.querySelector(selector)
      : els.interfaceLanguageSwitch.querySelector(selector);
    if (button && button.getClientRects().length > 0) button.focus();
  });
}

function loadState() {
  const raw = localStorage.getItem(ownedStorageKey(STORAGE_KEY));
  const loaded = raw ? deserializeState(raw) : createEmptyState();
  if (!loaded.user) return { ...loaded, user: createSeedState().user };
  return loaded;
}

function saveState() {
  localStorage.setItem(ownedStorageKey(STORAGE_KEY), serializeState(state));
}

function loadReadReceipts() {
  try {
    return JSON.parse(localStorage.getItem(ownedStorageKey(`${STORAGE_KEY}-read-receipts`)) || '{}');
  } catch {
    return {};
  }
}

function saveReadReceipts() {
  localStorage.setItem(ownedStorageKey(`${STORAGE_KEY}-read-receipts`), JSON.stringify(readReceipts));
}

function loadSavedPicks() {
  try {
    return JSON.parse(localStorage.getItem(ownedStorageKey(`${STORAGE_KEY}-saved-picks`)) || '{}');
  } catch {
    return {};
  }
}

function saveSavedPicks() {
  localStorage.setItem(ownedStorageKey(`${STORAGE_KEY}-saved-picks`), JSON.stringify(savedPicks));
}

function loadVocabBook() {
  return deserializeVocabBook(localStorage.getItem(ownedStorageKey(`${STORAGE_KEY}-vocab-book`)) || '[]');
}

function saveVocabBook() {
  localStorage.setItem(ownedStorageKey(`${STORAGE_KEY}-vocab-book`), serializeVocabBook(vocabBook));
}

function loadSettingsState() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(ownedStorageKey(SETTINGS_KEY)) || '{}');
  } catch {
    stored = {};
  }
  return createSettingsState({
    ...stored,
    interfaceLocale: onboarding.interfaceLocale,
    reduceMotion,
    proactiveContact: stored.proactiveContact || 'sometimes',
    readingMode: stored.readingMode || 'auto',
    soundEnabled: stored.soundEnabled !== false
  });
}

function loadOwnedNotificationPreferences() {
  let next = normalizeNotificationPreferences({
    ...loadNotificationPreferences(localStorage, ownedStorageKey(NOTIFICATIONS_KEY)),
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  });
  if (['denied', 'unsupported'].includes(next.permission)) next = { ...next, enabled: false };
  return next;
}

function switchLocalDataOwner(nextUserId = '') {
  const nextOwner = String(nextUserId || '');
  if (nextOwner === storageOwnerId) return false;
  if (nextOwner && !storageOwnerId) migrateGuestStorage(localStorage, ACCOUNT_STORAGE_KEYS, nextOwner);
  storageOwnerId = nextOwner;
  state = loadState();
  onboarding = loadOnboardingState();
  notificationPreferences = loadOwnedNotificationPreferences();
  readReceipts = loadReadReceipts();
  savedPicks = loadSavedPicks();
  vocabBook = loadVocabBook();
  settingsState = loadSettingsState();
  wythUiState = setReadingMode(createWythUiState(), settingsState.quick.readingMode);
  editingCompanionId = null;
  backendMemoryStatus = {};
  chatUiState = { pendingCompanionId: null, error: '' };
  pendingSelection = null;
  activeTranslation = null;
  activeSupportSignal = null;
  supportTrigger = null;
  reconcileInterfaceLocale();
  return true;
}

function commitSettingsState(nextState) {
  const result = persistQuickSettings(localStorage, ownedStorageKey(SETTINGS_KEY), settingsState, nextState);
  settingsState = result.state;
  interfaceStorageErrorKey = result.ok ? '' : 'error.storageUnavailable';
  return result.ok;
}

function saveSettingsState() {
  return commitSettingsState(settingsState);
}

function persistNotificationPreferences(next = notificationPreferences) {
  if (!saveNotificationPreferences(localStorage, ownedStorageKey(NOTIFICATIONS_KEY), next)) {
    interfaceStorageErrorKey = 'error.storageUnavailable';
    return false;
  }
  notificationPreferences = next;
  interfaceStorageErrorKey = '';
  return true;
}

function notificationPermissionStatus() {
  if (notificationPreferences.permission === 'unsupported') return tr('settings.notifications.unsupported');
  if (notificationPreferences.permission === 'denied') return tr('settings.notifications.denied');
  if (notificationPreferences.permission === 'granted') return tr('settings.notifications.granted');
  return tr('settings.notifications.notRequested');
}

function captureSettingsView() {
  return {
    draft: els.messageInput.value,
    transcript: captureTranscriptView(els.messageList),
    companionId: state.selectedCompanionId
  };
}

function restoreSettingsView(view) {
  if (!view || view.companionId !== state.selectedCompanionId) return;
  els.messageInput.value = view.draft;
  els.messageList.scrollTop = restoreTranscriptView(view.transcript, els.messageList);
}

function activeCompanion() {
  return state.companions.find((companion) => companion.id === state.selectedCompanionId) || state.companions[0];
}

function companionMessages(companionId) {
  return state.messages.filter((message) => message.companionId === companionId);
}

function formatCategory(category) {
  const key = ID_TO_TRANSLATION_KEY.category?.[category];
  return key ? tr(key) : CATEGORY_LIBRARY[category]?.label || category.replaceAll('_', ' ');
}

function formatLanguage(language) {
  const key = ID_TO_TRANSLATION_KEY.practiceLanguage?.[language];
  if (key) return tr(key);
  const entry = LANGUAGE_LIBRARY[language] || LANGUAGE_LIBRARY.english;
  return entry.nativeLabel || entry.label;
}

function formatCareValue(value, group) {
  const key = ID_TO_TRANSLATION_KEY[group]?.[value];
  if (key) return tr(key);
  return String(value || '')
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatProvider(provider) {
  const key = ID_TO_TRANSLATION_KEY.provider?.[provider];
  return key ? tr(key) : formatCareValue(provider);
}

function formatCorrectionMode(mode) {
  return formatCareValue(mode, 'correctionMode');
}

function formatModelProvider(provider) {
  const option = runtimeStatus.modelOptions?.[provider];
  return option?.label || formatCareValue(provider);
}

function lastMessage(companionId) {
  const messages = companionMessages(companionId);
  return messages[messages.length - 1]?.content || tr('empty.messages');
}

function latestEmotionFor(companionId) {
  return [...companionMessages(companionId)]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata?.emotion)
    ?.metadata.emotion || null;
}

function render({ preserveView = false, skipSettings = false } = {}) {
  const draft = preserveView ? els.messageInput.value : '';
  const transcriptView = preserveView ? captureTranscriptView(els.messageList) : null;
  const companion = activeCompanion();
  renderFirstUse();
  if (!companion) {
    syncShellState();
    return;
  }
  renderScene(companion);
  renderCompanionList();
  renderProfileCard();
  renderChatHeader(companion);
  renderSupportPresence(companion);
  renderMessages(companion);
  renderComposer(companion);
  if (!skipSettings) renderStudio(companion);
  syncShellState();
  if (preserveView) {
    els.messageInput.value = draft;
    els.messageList.scrollTop = restoreTranscriptView(transcriptView, els.messageList);
  }
  applyTranslatedAttributes();
}

function renderFirstUse() {
  const visible = state.companions.length === 0;
  els.firstUse.hidden = !visible;
  if (!visible) return;
  const activeStage = ['welcome', 'language', 'birthday', 'companion'].includes(onboarding.stage)
    ? onboarding.stage
    : 'companion';
  let activeSection = null;
  els.firstUse.querySelectorAll('[data-onboarding-stage]').forEach((section) => {
    section.hidden = section.dataset.onboardingStage !== activeStage;
    if (!section.hidden) activeSection = section;
  });
  const activeHeading = activeSection?.querySelector('h2[id]');
  if (activeHeading) els.firstUse.setAttribute('aria-labelledby', activeHeading.id);
  els.onboardingBirthday.max = localCalendarDate();
  els.onboardingBirthday.value = onboarding.birthday || els.onboardingBirthday.value;
  els.onboardingPresetList.innerHTML = WYTH_PRESETS.map((preset) => `
    <button type="button" data-preset-id="${preset.id}" style="--preset-scene:url('${sceneForId(preset.sceneId).baseAsset}')">
      <strong>${escapeHtml(tr(`preset.${preset.id}.name`))}</strong>
      <span>${escapeHtml(tr(`preset.${preset.id}.description`))}</span>
    </button>
  `).join('');
  els.onboardingStorageError.textContent = interfaceStorageErrorKey ? tr(interfaceStorageErrorKey) : '';
  applyTranslatedAttributes(els.firstUse);
}

function createCompanionFromPreset(presetId) {
  const preset = WYTH_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;
  const companion = createCompanion({
    ...preset,
    id: `companion_${preset.id}_${Date.now()}`,
    name: tr(`preset.${preset.id}.name`),
    language: 'english',
    pushCategories: ['psychology', 'healing_news'],
    memoryEnabled: true,
    careStyle: { intimacyLevel: 'gentle', proactiveCareFrequency: 'sometimes', ...preset.careStyle }
  });
  const nextState = {
    ...state,
    selectedCompanionId: companion.id,
    companions: [companion],
    messages: [{ id: `msg_${companion.id}_welcome`, companionId: companion.id, role: 'assistant', content: buildWelcomeContent(companion), createdAt: new Date().toISOString() }]
  };
  const nextOnboarding = { ...onboarding, stage: 'complete', completed: true };
  if (!persistNextInterfaceState(nextOnboarding, nextState)) return;
  render();
}

function syncShellState() {
  const shell = document.querySelector('.app-shell');
  shell.classList.toggle('is-transitioning', wythUiState.transition.phase !== 'idle');
  shell.classList.toggle('is-history-reading', wythUiState.historyReading);
  shell.dataset.transitionDirection = String(wythUiState.transition.direction);
  shell.dataset.sceneTime = resolveSceneTime(new Date().getHours());
  shell.dataset.ambientKind = resolveAmbientDescriptor(activeCompanion()?.sceneId).kind;
  syncAtmosphere();
}

function shouldAnimateScene() {
  return !document.hidden && !reduceMotion && !activeDrawer && !wythUiState.historyReading && wythUiState.transition.phase === 'idle' && Boolean(activeCompanion());
}

function syncAtmosphere() {
  if (!shouldAnimateScene()) {
    window.cancelAnimationFrame(atmosphereFrame);
    atmosphereFrame = 0;
    return;
  }
  if (!atmosphereFrame) animateAtmosphere();
}

function animateAtmosphere() {
  const canvas = els.sceneAtmosphere;
  const descriptor = resolveAmbientDescriptor(activeCompanion()?.sceneId);
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    const count = Math.min(descriptor.cap, window.innerWidth < 760 ? Math.ceil(descriptor.cap * .55) : descriptor.cap);
    atmosphereParticles = Array.from({ length: count }, (_, index) => ({
      x: (index * 97) % width,
      y: (index * 53) % height,
      size: 1 + (index % 3),
      speed: .08 + (index % 5) * .025,
      phase: index * .73
    }));
  }
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.fillStyle = descriptor.color;
  context.strokeStyle = descriptor.color;
  for (const particle of atmosphereParticles) {
    if (descriptor.kind === 'rain') {
      particle.y += 1.8 + particle.speed * 5;
      particle.x -= .25;
      if (particle.y > height + 18) particle.y = -18;
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.lineTo(particle.x - 3, particle.y + 15 + particle.size * 2);
      context.stroke();
    } else if (descriptor.kind === 'passing_light') {
      particle.x += 1.2 + particle.speed * 7;
      if (particle.x > width + 120) particle.x = -120;
      context.fillRect(particle.x, particle.y, 70 + particle.size * 34, .8 + particle.size * .35);
    } else if (descriptor.kind === 'city_glow') {
      particle.phase += .012 + particle.speed * .02;
      context.globalAlpha = .22 + (Math.sin(particle.phase) + 1) * .16;
      context.fillRect(particle.x, particle.y, 5 + particle.size * 3, 9 + particle.size * 5);
    } else {
      particle.y -= descriptor.kind === 'page_light' ? particle.speed * .7 : particle.speed;
      particle.x += Math.sin(particle.y / 90 + particle.phase) * (descriptor.kind === 'curtain_dust' ? .13 : .06);
      if (particle.y < -8) particle.y = height + 8;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  atmosphereFrame = shouldAnimateScene() ? window.requestAnimationFrame(animateAtmosphere) : 0;
}

function renderScene(companion) {
  const scene = sceneForId(companion.sceneId);
  const currentAsset = els.sceneCurrent.dataset.sceneAsset;
  if (currentAsset === scene.baseAsset) return;
  if (currentAsset) {
    els.sceneOutgoing.style.backgroundImage = els.sceneCurrent.style.backgroundImage;
    els.sceneOutgoing.classList.remove('is-hidden');
    els.sceneOutgoing.classList.add('is-leaving');
  }
  window.clearTimeout(sceneCleanupTimer);
  els.sceneCurrent.style.backgroundImage = `url("${scene.baseAsset}")`;
  els.sceneCurrent.dataset.sceneAsset = scene.baseAsset;
  els.sceneCurrent.classList.remove('is-entering');
  requestAnimationFrame(() => els.sceneCurrent.classList.add('is-entering'));
  sceneCleanupTimer = window.setTimeout(() => {
    els.sceneOutgoing.classList.remove('is-leaving');
    els.sceneOutgoing.classList.add('is-hidden');
  }, 760);
}

function openUtilityDrawer(section = 'settings') {
  activeDrawer = section;
  if (section === 'settings') settingsState = openQuickSettings(settingsState);
  els.utilityDrawer.classList.add('is-open');
  els.utilityDrawer.setAttribute('aria-hidden', 'false');
  els.utilityDrawer.removeAttribute('inert');
  els.drawerTitle.textContent = tr(section === 'vocabulary' ? 'vocabulary.title' : 'settings.title');
  renderStudio(activeCompanion());
  window.setTimeout(() => els.closeDrawerButton.focus(), 0);
}

function closeUtilityDrawer() {
  if (settingsState.surface === 'full') {
    closeFullSettings();
    return;
  }
  activeDrawer = '';
  settingsState = closeSettings(settingsState);
  els.utilityDrawer.classList.remove('is-open');
  els.utilityDrawer.setAttribute('aria-hidden', 'true');
  els.utilityDrawer.setAttribute('inert', '');
  drawerTrigger?.focus();
  drawerTrigger = null;
}

function openFullSettingsSurface(section = settingsState.activeSection) {
  settingsView = captureSettingsView();
  settingsState = openFullSettings(settingsState, section);
  els.fullSettings.classList.add('is-open');
  els.fullSettings.setAttribute('aria-hidden', 'false');
  els.fullSettings.removeAttribute('inert');
  setSettingsBackgroundInert(true);
  renderFullSettings(activeCompanion());
  window.setTimeout(() => els.fullSettingsNav.querySelector('[aria-current="page"]')?.focus(), 0);
}

function closeFullSettings() {
  settingsState = closeSettings(settingsState);
  els.fullSettings.classList.remove('is-open');
  els.fullSettings.setAttribute('aria-hidden', 'true');
  els.fullSettings.setAttribute('inert', '');
  setSettingsBackgroundInert(false);
  restoreSettingsView(settingsView);
  settingsView = null;
  if (settingsState.surface === 'quick') {
    renderQuickSettings();
    window.setTimeout(() => els.studioPanel.querySelector('[data-action="open-full-settings"]')?.focus(), 0);
  } else {
    drawerTrigger?.focus();
  }
}

function setSettingsBackgroundInert(inert) {
  const shell = document.querySelector('.app-shell');
  const elements = Array.from(shell?.children || []).filter((element) => element !== els.fullSettings);
  for (const element of elements) {
    if (inert) {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    } else {
      element.removeAttribute('inert');
      if (element === els.utilityDrawer) element.setAttribute('aria-hidden', activeDrawer ? 'false' : 'true');
      else if (!element.classList.contains('scene-viewport')) element.removeAttribute('aria-hidden');
    }
  }
}

function trapFullSettingsFocus(event) {
  if (event.key !== 'Tab' || settingsState.surface !== 'full') return;
  if (els.profileDialog.open || els.createDialog.open) return;
  const focusable = Array.from(els.fullSettings.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]'))
    .filter((element) => element.getClientRects().length > 0);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderProfileCard() {
  els.openProfileButton.innerHTML = `
    <span>
      <strong>${escapeHtml(state.user.displayName)}</strong>
      <small>${escapeHtml(state.user.email)}</small>
    </span>
    <span class="privacy-pill">${tr(state.user.privacy.allowAiTraining ? 'profile.trainingAllowed' : 'profile.trainingOptedOut')}</span>
  `;
}

function renderCompanionList() {
  els.companionList.innerHTML = state.companions.map((companion) => {
    const hasPush = companionMessages(companion.id).some((message) => message.role === 'system_push');
    const active = companion.id === state.selectedCompanionId ? ' active' : '';
    const unreadCount = companion.id === state.selectedCompanionId
      ? 0
      : countUnreadCompanionMessages(state.messages, {
        companionId: companion.id,
        lastReadAt: readReceipts[companion.id]
      });
    return `
      <button class="companion-card${active}" type="button" data-companion-id="${companion.id}" aria-current="${active ? 'true' : 'false'}" title="${escapeHtml(companion.name)}">
        ${renderAvatar(companion)}
        <span>
          <span class="card-title-row">
            <span class="companion-name">${escapeHtml(companion.name)}</span>
            <span class="card-badges">
              ${unreadCount > 0 ? `<span class="unread-dot">${unreadCount}</span>` : ''}
              ${hasPush ? '<span class="daily-dot">DP</span>' : ''}
            </span>
          </span>
          <span class="companion-meta">${escapeHtml(localizedRelationship(companion.relationshipType))} / ${escapeHtml(companion.personality)}</span>
          <span class="last-message">${escapeHtml(lastMessage(companion.id))}</span>
        </span>
      </button>
    `;
  }).join('') + (chatUiState.error ? `<div class="chat-error" role="alert">${tr(chatUiState.error)}</div>` : '');
}

function renderAvatar(companion) {
  if (companion.avatar?.kind === 'custom') {
    return `<img class="avatar avatar-image" src="${companion.avatar.dataUrl}" alt="">`;
  }
  return `<span class="avatar avatar-image" style="background:${companion.avatarColor}"><img src="${sceneForId(companion.sceneId).avatarAsset}" alt=""></span>`;
}

function renderAvatarDraft() {
  const scene = sceneForId(creationFlow.draft.sceneId);
  const source = pendingAvatar?.kind === 'custom' ? pendingAvatar.dataUrl : scene.avatarAsset;
  const markup = `<img src="${source}" alt="${escapeHtml(tr('avatar.preview'))}"><span>${tr(pendingAvatar?.kind === 'custom' ? 'avatar.customReady' : 'avatar.defaultReady')}</span>`;
  els.avatarPreview.innerHTML = markup;
  if (els.advancedAvatarPreview) els.advancedAvatarPreview.innerHTML = markup;
}

function setAvatarError(message) {
  els.avatarError.textContent = message;
  els.advancedAvatarError.textContent = message;
}

function localizedRelationship(value) {
  const key = ID_TO_TRANSLATION_KEY.relationship?.[value];
  return key ? tr(key) : value;
}

function renderChatHeader(companion) {
  const llmLabel = runtimeStatus.llm?.configured
    ? `${runtimeStatus.llm.model} / ${formatChatSource(runtimeStatus.llm.lastChatSource)}`
    : tr('chat.sourceFallback');
  els.chatHeader.innerHTML = `
    <div class="chat-identity">
      ${renderAvatar(companion)}
      <div>
        <div class="chat-title-row">
          <h2>${escapeHtml(companion.name)}</h2>
        </div>
        <p class="companion-meta">${escapeHtml(localizedRelationship(companion.relationshipType))} / ${escapeHtml(companion.personality)}</p>
      </div>
    </div>
    <div class="chat-header-tags">
      <span class="lang-pill">${escapeHtml(formatLanguage(companion.language))}</span>
      <span class="status-pill" title="${escapeHtml(runtimeStatus.llm?.baseUrl || tr('chat.sourceFallback'))}">${escapeHtml(llmLabel)}</span>
    </div>
  `;
}

function renderMessages(companion) {
  const messages = buildRenderableMessages(state.messages, {
    companionId: companion.id,
    pendingCompanionId: chatUiState.pendingCompanionId
  });
  if (messages.length === 0) {
    els.messageList.innerHTML = `<div class="empty-state">${tr('empty.chat')}</div>`;
    return;
  }

  els.messageList.innerHTML = messages.map((message) => {
    const label = message.role === 'system_push' ? tr('dailyPick.title') : message.role === 'user' ? tr('chat.you') : companion.name;
    const linked = linkify(escapeHtml(message.content));
    const sourceCard = message.role === 'system_push' && message.metadata
      ? renderSourceCard(message.metadata, companion)
      : '';
    const chatSource = message.role === 'assistant' && message.metadata?.chatSource
      ? renderChatSource(message.metadata.chatSource)
      : '';
    const localTime = formatChatTimestamp(message.createdAt, { locale: onboarding.interfaceLocale });
    const pendingVisual = message.pending
      ? '<div class="pending-orb-cluster" role="status" aria-label="正在回复"><i></i><i></i><i></i><i></i><i></i></div>'
      : '';
    return `
      <article class="message ${message.role}">
        <div class="message-label">${escapeHtml(label)}</div>
        ${pendingVisual || `<p>${linked}</p>`}
        ${localTime ? `<time class="message-time" datetime="${escapeHtml(message.createdAt || '')}">${escapeHtml(localTime)}</time>` : ''}
        ${chatSource}
        ${sourceCard}
      </article>
    `;
  }).join('');
  els.messageList.scrollTop = els.messageList.scrollHeight;
}

function renderComposer(companion) {
  const isPending = Boolean(chatUiState.pendingCompanionId);
  const pendingCompanion = state.companions.find((item) => item.id === chatUiState.pendingCompanionId);
  els.messageInput.disabled = isPending;
  els.messageInput.placeholder = isPending
    ? tr('chat.replying', { name: pendingCompanion?.name || companion.name })
    : tr('chat.placeholder');
  const button = els.messageForm.querySelector('button[type="submit"]');
  button.disabled = isPending;
  button.textContent = tr(isPending ? 'chat.sending' : 'chat.send');
}

function renderSourceCard(metadata, companion) {
  const safeUrl = safeHttpUrl(metadata.url);
  const pushActions = createDailyPushActions({
    companion,
    message: {
      role: 'system_push',
      metadata
    }
  });
  return `
    <div class="source-card">
      <div class="source-type">${escapeHtml(metadata.sourceType || metadata.sourceLabel || 'source')}</div>
      <strong>${escapeHtml(metadata.title || tr('dailyPick.curatedSource'))}</strong>
      <span>${escapeHtml(metadata.summary || tr('dailyPick.curatedDescription'))}</span>
      ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${tr('dailyPick.openSource')}</a>` : ''}
      ${pushActions.length > 0 ? `
        <div class="source-actions">
          ${pushActions.map((item) => `
            <button
              class="source-action"
              type="button"
              data-action="${escapeHtml(item.action)}"
              data-category="${escapeHtml(item.category)}"
              data-source-id="${escapeHtml(metadata.sourceId || '')}"
              data-title="${escapeHtml(metadata.title || '')}"
              data-url="${escapeHtml(safeUrl)}"
              data-summary="${escapeHtml(metadata.summary || '')}"
              data-source-type="${escapeHtml(metadata.sourceType || metadata.sourceLabel || '')}"
              ${item.disabled ? 'disabled' : ''}
            >${escapeHtml(tr(item.labelKey))}</button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderChatSource(source) {
  const label = tr(source === 'llm' ? 'chat.sourceLlm' : 'chat.sourceFallback');
  return `<div class="chat-source ${source === 'llm' ? 'llm' : 'fallback'}">${label}</div>`;
}

function renderStudio(companion) {
  els.openProfileButton.hidden = activeDrawer === 'settings';
  if (activeDrawer === 'vocabulary') {
    renderLegacyStudio(companion);
    return;
  }
  renderQuickSettings();
  if (settingsState.surface === 'full') renderFullSettings(companion);
}

function renderSupportPresence(companion) {
  const presence = wythUiState.supportPresence;
  const visible = presence !== 'none' && Boolean(activeSupportSignal);
  els.companionPresence.hidden = !visible;
  if (!visible) return;
  els.companionPresence.dataset.presence = presence;
  els.supportPresenceVisual.innerHTML = renderAvatar(companion);
  els.supportPresenceTitle.textContent = tr('support.title');
  const messageKey = activeSupportSignal.level === 'crisis'
    ? 'support.crisis'
    : activeSupportSignal.level === 'strong'
      ? 'support.strong'
      : activeSupportSignal.level === 'manual'
        ? 'support.manual'
        : 'support.light';
  els.supportPresenceMessage.textContent = tr(messageKey);
}

function showSupportPresence(signal, trigger = null) {
  activeSupportSignal = signal;
  supportTrigger = trigger;
  wythUiState = setSupportPresence(wythUiState, resolveSupportPresence(signal, { reduceMotion }));
  if (signal.suppressLearning) dismissSelectionActions({ clearSelection: true });
  render({ preserveView: true, skipSettings: true });
}

function dismissSupportPresence() {
  activeSupportSignal = null;
  wythUiState = setSupportPresence(wythUiState, 'none');
  render({ preserveView: true, skipSettings: true });
  supportTrigger?.focus();
  supportTrigger = null;
}

function renderQuickSettings() {
  els.studioPanel.innerHTML = `
    <div class="studio-card drawer-intro quick-settings-intro">
      <span class="eyebrow">${tr('settings.quick.title')}</span>
      <h2>${tr('settings.quick.title')}</h2>
      <p class="studio-muted">${tr('settings.quick.description')}</p>
      ${interfaceStorageErrorKey ? `<p class="studio-muted model-error" role="alert">${tr(interfaceStorageErrorKey)}</p>` : ''}
    </div>
    <div class="quick-settings-list">
      <div class="settings-language-row" role="group" aria-label="${escapeHtml(tr('accessibility.interfaceLanguage'))}">
        <span><strong>${tr('settings.language')}</strong><small>${tr('onboarding.language.description')}</small></span>
        <span class="settings-language-actions">
          <button type="button" data-locale="zh-CN" aria-pressed="${onboarding.interfaceLocale === 'zh-CN'}">中</button>
          <button type="button" data-locale="en" aria-pressed="${onboarding.interfaceLocale === 'en'}">EN</button>
        </span>
      </div>
      <label class="quick-setting-select">
        <span><strong>${tr('settings.proactiveContact')}</strong><small>${tr('settings.proactiveContact.description')}</small></span>
        <select data-setting="proactiveContact">
          ${['off', 'rarely', 'sometimes', 'daily'].map((value) => `<option value="${value}" ${settingsState.quick.proactiveContact === value ? 'selected' : ''}>${tr(value === 'off' ? 'common.off' : `enum.proactiveCare.${value}`)}</option>`).join('')}
        </select>
      </label>
      <div class="setting-toggle">
        <span><strong>${tr('settings.sound')}</strong><small>${tr('settings.sound.description')}</small></span>
        <button class="toggle-button${settingsState.quick.soundEnabled ? ' is-on' : ''}" type="button" data-setting="soundEnabled" aria-pressed="${settingsState.quick.soundEnabled}">${tr(settingsState.quick.soundEnabled ? 'common.on' : 'common.off')}</button>
      </div>
      <div class="setting-toggle">
        <span><strong>${tr('settings.reduceMotion')}</strong><small>${tr('settings.reduceMotion.description')}</small></span>
        <button class="toggle-button${reduceMotion ? ' is-on' : ''}" type="button" data-action="toggle-reduced-motion" data-setting="reduceMotion" aria-pressed="${reduceMotion}">${tr(reduceMotion ? 'common.on' : 'common.off')}</button>
      </div>
      <label class="quick-setting-select">
        <span><strong>${tr('settings.quick.readingMode')}</strong><small>${tr('settings.quick.readingModeDescription')}</small></span>
        <select data-setting="readingMode">
          ${['auto', 'scene', 'reading'].map((value) => `<option value="${value}" ${settingsState.quick.readingMode === value ? 'selected' : ''}>${tr(`settings.reading.${value}`)}</option>`).join('')}
        </select>
      </label>
    </div>
    <button class="full-settings-link" type="button" data-action="open-full-settings">${tr('settings.openFull')} <span aria-hidden="true">→</span></button>
  `;
}

function renderFullSettings(companion) {
  const visibleSections = companion ? FULL_SETTINGS_SECTIONS : ['account'];
  els.fullSettingsNav.innerHTML = visibleSections.map((section) => `
    <button type="button" data-settings-section="${section}" aria-current="${settingsState.activeSection === section ? 'page' : 'false'}">${tr(`settings.full.${section}`)}</button>
  `).join('');
  els.fullSettingsContent.innerHTML = `${interfaceStorageErrorKey ? `<p class="model-error" role="alert">${tr(interfaceStorageErrorKey)}</p>` : ''}${renderFullSettingsSection(companion, settingsState.activeSection)}`;
  applyTranslatedAttributes(els.fullSettings);
}

function renderFullSettingsSection(companion, section) {
  if (section === 'account') return renderAccountSettings(companion);
  if (section === 'companionship') return renderCompanionshipSettings(companion);
  if (section === 'characters') return renderCharacterSettings(companion);
  if (section === 'language') return renderLanguageSettings(companion);
  return renderPrivacySettings(companion);
}

function settingsStatus(key, value = 'settings.status.active') {
  return `<span class="settings-status settings-status-${key}">${tr(value)}</span>`;
}

function renderAccountSettings() {
  const llm = runtimeStatus.llm || {};
  const accountContent = authUiState.mode === 'password'
    ? renderAuthForm()
    : authUiState.state === 'authenticated' && authUiState.user
    ? `<div class="studio-card account-session-card">
        <div class="studio-row"><span>${tr('auth.signedInAs')}</span><strong>${escapeHtml(authUiState.user.email)}</strong></div>
        <p class="studio-muted">${tr('auth.syncScope')}</p>
        <button class="secondary-action" type="button" data-action="auth-logout" ${authUiState.busy ? 'disabled' : ''}>${tr('auth.logout')}</button>
      </div>`
    : authUiState.state === 'loading'
      ? `<div class="studio-card account-local-card" aria-busy="true"><div class="studio-row"><span>${tr('settings.account.signIn')}</span>${settingsStatus('coming', 'auth.status.checking')}</div><p class="studio-muted">${tr('auth.checkingDescription')}</p></div>`
      : authUiState.configured
      ? renderAuthForm()
      : `<div class="studio-card account-local-card"><div class="studio-row"><span>${tr('settings.account.signIn')}</span>${settingsStatus('coming', 'auth.status.awaitingConnection')}</div><p class="studio-muted">${tr('auth.localModeDescription')}</p></div>`;
  const headingKey = authUiState.mode === 'password' || authUiState.state === 'authenticated'
    ? 'auth.accountTitle'
    : authUiState.configured ? 'settings.account.signIn' : 'settings.account.localMode';
  const statusKey = authUiState.state === 'loading'
    ? 'auth.status.checking'
    : authUiState.state === 'authenticated' ? 'auth.status.signedIn' : authUiState.configured ? 'auth.status.signedOut' : 'auth.status.local';
  return `
    <section class="settings-section" aria-labelledby="settings-account-heading">
      <header><div><span class="eyebrow">${tr('settings.full.account')}</span><h3 id="settings-account-heading" tabindex="-1">${tr(headingKey)}</h3></div>${settingsStatus(authUiState.state === 'authenticated' ? 'active' : 'coming', statusKey)}</header>
      <div class="studio-card"><div class="studio-row"><span>${tr('studio.profile')}</span><strong>${escapeHtml(state.user.displayName)}</strong></div><p class="studio-muted">${tr('profile.localNotice')}</p><button class="secondary-action" type="button" data-action="edit-profile">${tr('profile.edit')}</button></div>
      ${accountContent}
      <aside class="studio-card product-announcement" role="note" aria-labelledby="model-switch-notice-title"><span class="eyebrow">${tr('announcement.label')}</span><h3 id="model-switch-notice-title">${tr('announcement.modelSwitchTitle')}</h3><p class="studio-muted">${tr('announcement.modelSwitchBody')}</p></aside>
      <div class="studio-card"><h3>${tr('model.runtime.title')}</h3><div class="studio-row"><span>${tr('model.status')}</span><strong>${tr(llm.configured ? 'status.configured' : 'status.notConfigured')}</strong></div><div class="studio-row"><span>${tr('model.provider')}</span><strong>${escapeHtml(formatModelProvider(llm.provider || 'deepseek'))}</strong></div><div class="studio-row"><span>${tr('model.modelName')}</span><strong>${escapeHtml(llm.model || tr('status.notConfigured'))}</strong></div></div>
    </section>`;
}

function renderAuthForm() {
  const mode = authUiState.mode;
  const isReset = mode === 'reset';
  const isPassword = mode === 'password';
  const titleKey = isReset ? 'auth.resetTitle' : isPassword ? 'auth.newPasswordTitle' : mode === 'signup' ? 'auth.signupTitle' : 'auth.loginTitle';
  const submitKey = isReset ? 'auth.sendReset' : isPassword ? 'auth.savePassword' : mode === 'signup' ? 'auth.signup' : 'auth.login';
  const emailInvalid = authInvalidField === 'email';
  const passwordInvalid = authInvalidField === 'password';
  return `<div class="studio-card auth-card" aria-busy="${authUiState.busy}">
    <div class="auth-card-heading"><span class="eyebrow">${tr('settings.account.signIn')}</span><h3>${tr(titleKey)}</h3><p class="studio-muted">${tr(isReset ? 'auth.resetDescription' : isPassword ? 'auth.newPasswordDescription' : 'auth.description')}</p></div>
    ${authUiState.noticeKey ? `<p class="auth-notice" id="auth-notice" role="status" aria-live="polite" tabindex="-1">${tr(authUiState.noticeKey)}</p>` : ''}
    ${authUiState.errorKey ? `<p class="auth-error" id="auth-error" role="alert" tabindex="-1">${tr(authUiState.errorKey)}</p>${authUiState.errorKey === 'auth.error.unavailable' ? `<button class="secondary-action auth-retry-action" type="button" data-action="auth-retry">${tr('auth.retryConnection')}</button>` : ''}` : ''}
    <form class="auth-form" data-auth-form="${mode}" novalidate>
      ${isPassword ? '' : `<label><span>${tr('profile.email')}</span><input name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" value="${escapeHtml(authFormEmail)}" ${emailInvalid ? 'aria-invalid="true" aria-describedby="auth-error"' : ''} required></label>`}
      ${isReset ? '' : `<label><span>${tr(isPassword ? 'auth.newPassword' : 'auth.password')}</span><input name="password" type="password" autocomplete="${isPassword || mode === 'signup' ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" aria-describedby="auth-password-hint${passwordInvalid ? ' auth-error' : ''}" ${passwordInvalid ? 'aria-invalid="true"' : ''} required><small id="auth-password-hint">${tr('auth.passwordHint')}</small></label>`}
      <button class="primary-action" type="submit" ${authUiState.busy ? 'disabled' : ''}>${tr(authUiState.busy ? 'auth.working' : submitKey)}</button>
    </form>
    ${isPassword ? '' : `<div class="auth-secondary-actions">
      ${mode !== 'login' ? `<button type="button" data-auth-mode="login">${tr('auth.haveAccount')}</button>` : `<button type="button" data-auth-mode="signup">${tr('auth.createAccount')}</button>`}
      ${mode !== 'reset' ? `<button type="button" data-auth-mode="reset">${tr('auth.forgotPassword')}</button>` : ''}
    </div>`}
  </div>`;
}

function renderCompanionshipSettings(companion) {
  const memoryStatus = backendMemoryStatus[companion.id];
  const memoryBytes = memoryStatus?.approxBytes ? `${Math.ceil(memoryStatus.approxBytes / 1024)} KB` : '0 KB';
  const memorySummary = memoryStatus?.promptSummary || companion.memorySummary || '';
  const latestEmotion = latestEmotionFor(companion.id);
  const notificationButtonKey = notificationPreferences.enabled
    ? 'settings.notifications.disable'
    : notificationPreferences.permission === 'denied'
      ? 'settings.notifications.browserSettings'
      : 'settings.notifications.enable';
  const notificationButtonDisabled = notificationPermissionPending || ['denied', 'unsupported'].includes(notificationPreferences.permission);
  return `
    <section class="settings-section" aria-labelledby="settings-companionship-heading">
      <header><div><span class="eyebrow">${tr('settings.full.companionship')}</span><h3 id="settings-companionship-heading">${tr('settings.companionship.frequency')}</h3></div>${settingsStatus('active')}</header>
      <div class="studio-card"><h3>${tr('studio.careStatus')}</h3><div class="studio-row"><span>${tr('studio.detectedMood')}</span><strong>${escapeHtml(formatCareValue(latestEmotion?.label || 'neutral', 'mood'))}</strong></div><div class="studio-row"><span>${tr('studio.valence')}</span><strong>${escapeHtml(formatCareValue(latestEmotion?.valence || 'neutral', 'valence'))}</strong></div><p class="studio-muted">${escapeHtml(latestEmotion?.supportHint || tr('empty.mood'))}</p></div>
      <div class="studio-card"><div class="studio-row"><span>${tr('settings.proactiveContact')}</span><strong>${tr(settingsState.quick.proactiveContact === 'off' ? 'common.off' : `enum.proactiveCare.${settingsState.quick.proactiveContact}`)}</strong></div><p class="studio-muted">${tr('settings.proactiveContact.description')}</p></div>
      <div class="studio-card notification-preferences"><h3>${tr('studio.notifications')}</h3><div class="studio-row"><span>${tr('settings.notifications.permission')}</span><strong>${escapeHtml(notificationPermissionStatus())}</strong></div><button class="secondary-action" type="button" data-action="toggle-notifications" ${notificationButtonDisabled ? 'disabled' : ''}>${tr(notificationButtonKey)}</button>${notificationPreferences.permission === 'denied' ? `<p class="studio-muted">${tr('settings.notifications.deniedHelp')}</p>` : ''}<div class="studio-row"><span>${tr('studio.quietHours')}</span><button class="secondary-action" type="button" data-action="toggle-quiet-hours">${tr(notificationPreferences.quietHours.enabled ? 'dailyPick.disableQuietHours' : 'dailyPick.enableQuietHours')}</button></div><div class="quiet-hours-fields"><label>${tr('settings.notifications.quietStart')}<input type="time" data-notification-setting="quietStart" value="${escapeHtml(notificationPreferences.quietHours.start)}"></label><label>${tr('settings.notifications.quietEnd')}<input type="time" data-notification-setting="quietEnd" value="${escapeHtml(notificationPreferences.quietHours.end)}"></label></div></div>
      <div class="studio-card"><h3>${tr('studio.longTermMemory')}</h3><div class="studio-row"><span>${tr('studio.savedItems')}</span><strong>${memoryStatus?.entryCount || 0}</strong></div><div class="studio-row"><span>${tr('studio.size')}</span><strong>${memoryBytes}</strong></div><p class="studio-muted">${escapeHtml(memorySummary || tr('empty.memory'))}</p><button class="secondary-action" type="button" data-action="clear-memory" ${(memoryStatus?.entryCount || 0) === 0 ? 'disabled' : ''}>${tr('memory.clear')}</button></div>
      <div class="studio-card"><h3>${tr('settings.companionship.relationship')}</h3><div class="quick-actions"><button class="secondary-action" type="button" disabled>${tr('settings.companionship.pauseIntimacy')} · ${tr('common.comingSoon')}</button><button class="secondary-action" type="button" disabled>${tr('settings.companionship.friendMode')} · ${tr('common.comingSoon')}</button></div></div>
    </section>`;
}

function renderCharacterSettings(companion) {
  const retrievalPlan = buildContentRetrievalPlan(companion, { maxResultsPerQuery: 3 });
  const companionSavedPicks = savedPicks[companion.id] || [];
  return `
    <section class="settings-section" aria-labelledby="settings-characters-heading">
      <header><div><span class="eyebrow">${tr('settings.full.characters')}</span><h3 id="settings-characters-heading">${escapeHtml(companion.name)}</h3></div>${settingsStatus('active')}</header>
      <div class="studio-card"><h3>${tr('studio.companionSetup')}</h3><div class="studio-row"><span>${tr('studio.relationship')}</span><strong>${escapeHtml(localizedRelationship(companion.relationshipType))}</strong></div><div class="studio-row"><span>${tr('studio.tone')}</span><strong>${escapeHtml(companion.personality)}</strong></div><div class="studio-row"><span>${tr('studio.avatar')}</span><strong>${escapeHtml(formatCareValue(companion.avatarStyle, 'avatarStyle'))}</strong></div><div class="quick-actions"><button class="primary-action" type="button" data-action="edit-companion">${tr('creation.editSetup')}</button><button class="secondary-action" type="button" data-action="daily-pick">${tr('dailyPick.generate')}</button><button class="secondary-action" type="button" data-action="run-scheduler">${tr('dailyPick.runNow')}</button></div></div>
      <div class="studio-card"><h3>${tr('studio.dailyPush')}</h3><div class="studio-row"><span>${tr('studio.time')}</span><strong>${escapeHtml(companion.pushSchedule.time)}</strong></div><div class="studio-row"><span>${tr('studio.maxDaily')}</span><strong>${companion.pushSchedule.maxDaily}</strong></div><div class="tag-list">${companion.pushCategories.map((category) => `<button class="tag tag-button" type="button" data-action="stop-category" data-category="${escapeHtml(category)}">${escapeHtml(formatCategory(category))} x</button>`).join('')}</div>${companion.customKeywords?.length ? `<div class="tag-list">${companion.customKeywords.map((keyword) => `<span class="tag keyword-tag">${escapeHtml(keyword)}</span>`).join('')}</div>` : ''}</div>
      <div class="studio-card"><h3>${tr('studio.savedPicks')}</h3>${companionSavedPicks.length ? `<div class="retrieval-stack">${companionSavedPicks.slice(0,3).map((item) => `<div class="retrieval-item"><strong>${escapeHtml(item.title || tr('dailyPick.savedDefaultTitle'))}</strong><span>${escapeHtml(item.summary || item.sourceType || tr('dailyPick.savedForLater'))}</span></div>`).join('')}</div>` : `<p class="studio-muted">${tr('dailyPick.emptySaved')}</p>`}</div>
      <div class="studio-card"><h3>${tr('studio.retrievalPlan')}</h3><div class="tag-list">${(companion.contentSources?.enabledProviders || []).map((provider) => `<span class="tag provider-tag">${escapeHtml(formatProvider(provider))}</span>`).join('')}</div><div class="retrieval-stack">${retrievalPlan.length ? retrievalPlan.slice(0,5).map((item) => `<div class="retrieval-item"><strong>${escapeHtml(formatProvider(item.provider))}</strong><span>${escapeHtml(item.query)}</span></div>`).join('') : `<p class="studio-muted">${tr('dailyPick.providerRequired')}</p>`}</div></div>
      <div class="studio-card"><h3>${tr('studio.localScheduler')}</h3><div class="studio-row"><span>${tr('studio.lastCheck')}</span><strong>${schedulerStatus.lastRunAt ? escapeHtml(formatTime(schedulerStatus.lastRunAt)) : tr('common.notYet')}</strong></div><div class="studio-row"><span>${tr('studio.lastAlerts')}</span><strong>${schedulerStatus.lastNotifications.length}</strong></div><div class="studio-row"><span>${tr('studio.sourceMode')}</span><strong>${tr(schedulerStatus.lastSourceMode === 'external' ? 'dailyPick.sourceExternal' : 'dailyPick.sourceFallback')}</strong></div></div>
      <button class="danger-action" type="button" data-action="delete-companion">${tr('creation.delete')}</button>
    </section>`;
}

function renderLanguageSettings(companion) {
  return `
    <section class="settings-section" aria-labelledby="settings-language-heading">
      <header><div><span class="eyebrow">${tr('settings.full.language')}</span><h3 id="settings-language-heading">${tr('settings.language.practice')}</h3></div>${settingsStatus('active')}</header>
      <div class="studio-card"><div class="studio-row"><span>${tr('settings.language.interface')}</span><strong>${tr(`settings.language.${onboarding.interfaceLocale === 'en' ? 'en' : 'zh'}`)}</strong></div><div class="studio-row"><span>${tr('settings.language.practice')}</span><strong>${escapeHtml(formatLanguage(companion.language))}</strong></div><div class="studio-row"><span>${tr('studio.correction')}</span><strong>${escapeHtml(formatCorrectionMode(companion.practiceStyle?.correctionMode || 'off'))}</strong></div><div class="studio-row"><span>${tr('studio.level')}</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.correctionIntensity || 'light', 'correctionIntensity'))}</strong></div><div class="studio-row"><span>${tr('studio.replyLength')}</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.replyLength || 'medium', 'replyLength'))}</strong></div><div class="studio-row"><span>${tr('studio.naturalPhrases')}</span><strong>${tr(companion.practiceStyle?.naturalPhrases === false ? 'common.off' : 'common.on')}</strong></div></div>
      <div class="studio-card"><h3>${tr('vocabulary.title')}</h3><div class="studio-row"><span>${tr('vocabulary.savedCount')}</span><strong>${vocabBook.length}</strong></div>${vocabBook.length ? `<div class="vocab-list">${vocabBook.map((entry) => `<div class="vocab-item"><span><span class="vocab-text">${escapeHtml(entry.text)}</span><span class="vocab-translation">${escapeHtml(entry.translation || entry.explanation || '')}</span></span><button class="vocab-remove" type="button" data-action="remove-vocab" data-vocab-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(tr('accessibility.removeWord', { word: entry.text }))}">x</button></div>`).join('')}</div>` : `<p class="studio-muted">${tr('vocabulary.empty')}</p>`}<button class="secondary-action" type="button" data-action="open-vocabulary">${tr('common.open')}</button></div>
    </section>`;
}

function renderPrivacySettings() {
  return `
    <section class="settings-section" aria-labelledby="settings-privacy-heading">
      <header><div><span class="eyebrow">${tr('settings.full.privacy')}</span><h3 id="settings-privacy-heading">${tr('settings.privacy.localStorage')}</h3></div>${settingsStatus('active')}</header>
      <div class="studio-card"><div class="studio-row"><span>${tr('studio.storage')}</span><strong>${tr('status.local')}</strong></div><div class="studio-row"><span>${tr('studio.aiTraining')}</span><strong>${tr(state.user.privacy.allowAiTraining ? 'profile.trainingAllowed' : 'profile.trainingOptedOut')}</strong></div><button class="secondary-action" type="button" data-action="toggle-training">${tr(state.user.privacy.allowAiTraining ? 'common.disable' : 'common.enable')}</button></div>
      <div class="studio-card"><div class="studio-row"><span>${tr('settings.privacy.cloudSync')}</span>${settingsStatus('coming', 'status.accountSyncComingSoon')}</div><div class="quick-actions"><button class="secondary-action" type="button" disabled>${tr('settings.privacy.download')} · ${tr('common.comingSoon')}</button><button class="secondary-action" type="button" disabled>${tr('settings.privacy.deleteCloud')} · ${tr('common.comingSoon')}</button></div></div>
    </section>`;
}

function renderLegacyStudio(companion) {
  const latestPush = [...companionMessages(companion.id)].reverse().find((message) => message.role === 'system_push');
  const notificationPreview = latestPush
    ? previewNotification(companion, latestPush, notificationPreferences)
    : null;
  const retrievalPlan = buildContentRetrievalPlan(companion, { maxResultsPerQuery: 3 });
  const memoryStatus = backendMemoryStatus[companion.id];
  const memoryBytes = memoryStatus?.approxBytes ? `${Math.ceil(memoryStatus.approxBytes / 1024)} KB` : '0 KB';
  const memorySummary = memoryStatus?.promptSummary || companion.memorySummary || '';
  const latestEmotion = latestEmotionFor(companion.id);
  const companionSavedPicks = savedPicks[companion.id] || [];

  if (activeDrawer === 'vocabulary') {
    els.studioPanel.innerHTML = `
      <div class="studio-card drawer-intro">
        <span class="eyebrow">${tr('vocabulary.eyebrow')}</span>
        <h2>${tr('vocabulary.title')}</h2>
        <p class="studio-muted">${tr('vocabulary.description')}</p>
      </div>
      <div class="studio-card">
        <div class="studio-row"><span>${tr('vocabulary.savedCount')}</span><strong>${vocabBook.length}</strong></div>
        ${vocabBook.length > 0 ? `
          <div class="vocab-list">
            ${vocabBook.map((entry) => `
              <div class="vocab-item">
                <span><span class="vocab-text">${escapeHtml(entry.text)}</span><span class="vocab-translation">${escapeHtml(entry.translation || entry.explanation || '')}</span></span>
                <button class="vocab-remove" type="button" data-action="remove-vocab" data-vocab-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(tr('accessibility.removeWord', { word: entry.text }))}">x</button>
              </div>
            `).join('')}
          </div>
        ` : `<p class="studio-muted empty-drawer-copy">${tr('vocabulary.empty')}</p>`}
      </div>
    `;
    return;
  }

  els.studioPanel.innerHTML = `
    <div class="studio-card drawer-intro">
      <span class="eyebrow">${tr('studio.eyebrow')}</span>
      <h2>${tr('studio.introTitle')}</h2>
      <p class="studio-muted">${tr('studio.introDescription')}</p>
      ${interfaceStorageErrorKey ? `<p class="studio-muted model-error" role="alert">${tr(interfaceStorageErrorKey)}</p>` : ''}
      <div class="settings-language-row" role="group" aria-label="${escapeHtml(tr('accessibility.interfaceLanguage'))}">
        <span><strong>${tr('settings.language')}</strong><small>${tr('onboarding.language.description')}</small></span>
        <span class="settings-language-actions">
          <button type="button" data-locale="zh-CN" aria-pressed="${onboarding.interfaceLocale === 'zh-CN'}">中</button>
          <button type="button" data-locale="en" aria-pressed="${onboarding.interfaceLocale === 'en'}">EN</button>
        </span>
      </div>
      <div class="setting-toggle">
        <span><strong>${tr('settings.reduceMotion')}</strong><small>${tr('settings.reduceMotion.description')}</small></span>
        <button class="toggle-button${reduceMotion ? ' is-on' : ''}" type="button" data-action="toggle-reduced-motion" aria-pressed="${reduceMotion}">${tr(reduceMotion ? 'common.on' : 'common.off')}</button>
      </div>
    </div>
    ${!state.user.birthday && !profilePromptDismissed ? `
      <div class="studio-card profile-completion-prompt">
        <p>${tr('onboarding.existingUserPrompt')}</p>
        <div class="quick-actions">
          <button class="secondary-action" type="button" data-action="complete-profile">${tr('profile.edit')}</button>
          <button class="secondary-action" type="button" data-action="dismiss-profile-prompt">${tr('common.skip')}</button>
        </div>
      </div>
    ` : ''}
    <div class="studio-card">
      <h2>${escapeHtml(tr('studio.companionTitle', { name: companion.name }))}</h2>
      <p class="studio-muted">${tr('studio.companionDescription')}</p>
      <div class="quick-actions">
        <button class="primary-action" type="button" data-action="daily-pick">${tr('dailyPick.generate')}</button>
        <button class="secondary-action" type="button" data-action="run-scheduler">${tr('dailyPick.runNow')}</button>
        <button class="secondary-action" type="button" data-action="edit-companion">${tr('creation.editSetup')}</button>
      </div>
    </div>

    ${renderModelSettings()}

    <div class="studio-card">
      <h3>${tr('studio.companionSetup')}</h3>
      <div class="studio-row"><span>${tr('studio.relationship')}</span><strong>${escapeHtml(localizedRelationship(companion.relationshipType))}</strong></div>
      <div class="studio-row"><span>${tr('studio.language')}</span><strong>${escapeHtml(formatLanguage(companion.language))}</strong></div>
      <div class="studio-row"><span>${tr('studio.tone')}</span><strong>${escapeHtml(companion.personality)}</strong></div>
      <div class="studio-row"><span>${tr('studio.avatar')}</span><strong>${escapeHtml(formatCareValue(companion.avatarStyle, 'avatarStyle'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.closeness')}</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.intimacyLevel || 'gentle', 'intimacy'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.support')}</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.supportMode || 'listen_first', 'supportMode'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.careHabit')}</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.proactiveCareFrequency || 'sometimes', 'proactiveCare'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.memory')}</span><strong>${tr(companion.memoryEnabled ? 'common.on' : 'common.off')}</strong></div>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.practiceStyle')}</h3>
      <div class="studio-row"><span>${tr('studio.correction')}</span><strong>${escapeHtml(formatCorrectionMode(companion.practiceStyle?.correctionMode || 'off'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.level')}</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.correctionIntensity || 'light', 'correctionIntensity'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.replyLength')}</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.replyLength || 'medium', 'replyLength'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.naturalPhrases')}</span><strong>${tr(companion.practiceStyle?.naturalPhrases === false ? 'common.off' : 'common.on')}</strong></div>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.careStatus')}</h3>
      <div class="studio-row"><span>${tr('studio.detectedMood')}</span><strong>${escapeHtml(formatCareValue(latestEmotion?.label || 'neutral', 'mood'))}</strong></div>
      <div class="studio-row"><span>${tr('studio.valence')}</span><strong>${escapeHtml(formatCareValue(latestEmotion?.valence || 'neutral', 'valence'))}</strong></div>
      <p class="studio-muted">${escapeHtml(latestEmotion?.supportHint || tr('empty.mood'))}</p>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.dailyPush')}</h3>
      <div class="studio-row"><span>${tr('studio.time')}</span><strong>${escapeHtml(companion.pushSchedule.time)}</strong></div>
      <div class="studio-row"><span>${tr('studio.maxDaily')}</span><strong>${companion.pushSchedule.maxDaily}</strong></div>
      <div class="tag-list">
        ${companion.pushCategories.map((category) => `
          <button class="tag tag-button" type="button" data-action="stop-category" data-category="${escapeHtml(category)}">
            ${escapeHtml(formatCategory(category))} x
          </button>
        `).join('')}
      </div>
      ${companion.customKeywords?.length > 0 ? `
        <div class="custom-keywords">
          <div class="section-label small-label">${tr('studio.customKeywords')}</div>
          <div class="tag-list">
            ${companion.customKeywords.map((keyword) => `<span class="tag keyword-tag">${escapeHtml(keyword)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <p class="studio-muted hint">${tr('studio.categoryStopHint')}</p>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.savedPicks')}</h3>
      ${companionSavedPicks.length > 0 ? `
        <div class="retrieval-stack">
          ${companionSavedPicks.slice(0, 3).map((item) => `
            <div class="retrieval-item">
              <strong>${escapeHtml(item.title || tr('dailyPick.savedDefaultTitle'))}</strong>
              <span>${escapeHtml(item.summary || item.sourceType || tr('dailyPick.savedForLater'))}</span>
              ${safeHttpUrl(item.url) ? `<a href="${escapeHtml(safeHttpUrl(item.url))}" target="_blank" rel="noreferrer">${tr('dailyPick.openSource')}</a>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `<p class="studio-muted">${tr('dailyPick.emptySaved')}</p>`}
    </div>

    <div class="studio-card">
      <h3>${tr('studio.wordBook')}</h3>
      <div class="studio-row"><span>${tr('vocabulary.savedCount')}</span><strong>${vocabBook.length}</strong></div>
      ${vocabBook.length > 0 ? `
        <div class="vocab-list">
          ${vocabBook.slice(0, 6).map((entry) => `
            <div class="vocab-item">
              <span>
                <span class="vocab-text">${escapeHtml(entry.text)}</span>
                <span class="vocab-translation">${escapeHtml(entry.translation || entry.explanation || '')}</span>
              </span>
              <button class="vocab-remove" type="button" data-action="remove-vocab" data-vocab-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(tr('accessibility.removeWord', { word: entry.text }))}">x</button>
            </div>
          `).join('')}
        </div>
        ${vocabBook.length > 6 ? `<p class="studio-muted hint">${tr('vocabulary.showingCount', { shown: 6, total: vocabBook.length })}</p>` : ''}
      ` : `<p class="studio-muted">${tr('vocabulary.description')}</p>`}
    </div>

    <div class="studio-card">
      <h3>${tr('studio.retrievalPlan')}</h3>
      <div class="tag-list">
        ${(companion.contentSources?.enabledProviders || []).map((provider) => `
          <span class="tag provider-tag">${escapeHtml(formatProvider(provider))}</span>
        `).join('')}
      </div>
      <div class="retrieval-stack">
        ${retrievalPlan.length > 0 ? retrievalPlan.slice(0, 5).map((item) => `
          <div class="retrieval-item">
            <strong>${escapeHtml(formatProvider(item.provider))}</strong>
            <span>${escapeHtml(item.query)}</span>
          </div>
        `).join('') : `<p class="studio-muted">${tr('dailyPick.providerRequired')}</p>`}
      </div>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.notificationPreview')}</h3>
      <div class="studio-row"><span>${tr('studio.notifications')}</span><strong>${tr(notificationPreferences.enabled ? 'common.on' : 'common.off')}</strong></div>
      <div class="studio-row"><span>${tr('studio.quietHours')}</span><strong>${notificationPreferences.quietHours.start} - ${notificationPreferences.quietHours.end}</strong></div>
      <p class="studio-muted">${
        notificationPreview
          ? notificationPreview.muted
            ? escapeHtml(notificationPreview.reason)
            : `${escapeHtml(notificationPreview.title)}: ${escapeHtml(notificationPreview.body)}`
          : tr('dailyPick.generateForPreview')
      }</p>
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="toggle-notifications">${tr(notificationPreferences.enabled ? 'common.disable' : 'common.enable')}</button>
        <button class="secondary-action" type="button" data-action="toggle-quiet-hours">${tr(notificationPreferences.quietHours.enabled ? 'dailyPick.disableQuietHours' : 'dailyPick.enableQuietHours')}</button>
      </div>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.localScheduler')}</h3>
      <p class="studio-muted">${tr('dailyPick.schedulerDescription')}</p>
      <div class="studio-row"><span>${tr('studio.lastCheck')}</span><strong>${schedulerStatus.lastRunAt ? escapeHtml(formatTime(schedulerStatus.lastRunAt)) : tr('common.notYet')}</strong></div>
      <div class="studio-row"><span>${tr('studio.lastAlerts')}</span><strong>${schedulerStatus.lastNotifications.length}</strong></div>
      <div class="studio-row"><span>${tr('studio.sourceMode')}</span><strong>${tr(schedulerStatus.lastSourceMode === 'external' ? 'dailyPick.sourceExternal' : 'dailyPick.sourceFallback')}</strong></div>
      ${schedulerStatus.lastNotifications.length > 0 ? `
        <div class="notification-stack">
          ${schedulerStatus.lastNotifications.map((item) => `
            <div class="notification-card">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.body)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="studio-card">
      <h3>${tr('studio.longTermMemory')}</h3>
      <div class="studio-row"><span>${tr('studio.storage')}</span><strong>${tr('status.local')}</strong></div>
      <div class="studio-row"><span>${tr('studio.savedItems')}</span><strong>${memoryStatus?.entryCount || 0}</strong></div>
      <div class="studio-row"><span>${tr('studio.size')}</span><strong>${memoryBytes}</strong></div>
      <p class="studio-muted">${escapeHtml(memorySummary || tr('empty.memory'))}</p>
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="clear-memory" ${(memoryStatus?.entryCount || 0) === 0 ? 'disabled' : ''}>${tr('memory.clear')}</button>
      </div>
    </div>

    <div class="studio-card">
      <h3>${tr('studio.privacyData')}</h3>
      <div class="studio-row"><span>${tr('studio.profile')}</span><strong>${escapeHtml(state.user.displayName)}</strong></div>
      <div class="studio-row"><span>${tr('studio.storage')}</span><strong>${tr(state.user.privacy.localOnly ? 'status.local' : 'status.cloudReady')}</strong></div>
      <div class="studio-row"><span>${tr('studio.aiTraining')}</span><strong>${tr(state.user.privacy.allowAiTraining ? 'profile.trainingAllowed' : 'profile.trainingOptedOut')}</strong></div>
      ${state.user.privacy.showPrivacyNotice ? `<p class="studio-muted">${tr('profile.localNotice')}</p>` : ''}
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="edit-profile">${tr('profile.edit')}</button>
        <button class="secondary-action" type="button" data-action="toggle-training">${tr(state.user.privacy.allowAiTraining ? 'common.disable' : 'common.enable')}</button>
      </div>
    </div>

    <button class="danger-action" type="button" data-action="delete-companion">${tr('creation.delete')}</button>
  `;
}

function renderModelSettings() {
  const llm = runtimeStatus.llm || {};
  const options = runtimeStatus.modelOptions || {};
  const provider = llm.provider || 'deepseek';
  const selectedOption = options[provider] || {};
  const providerOptions = Object.entries(options).length > 0
    ? Object.entries(options)
    : [[provider, {
      label: llm.label || formatModelProvider(provider),
      defaultModel: llm.model || '',
      baseUrl: llm.baseUrl || '',
      apiMode: llm.apiMode || 'chat_completions',
      keyEnv: llm.keyEnv || 'DEEPSEEK_API_KEY'
    }]];
  const statusText = modelSettingsState.errorKey
    ? tr(modelSettingsState.errorKey)
    : modelSettingsState.savedAt
      ? tr('model.savedAt', { time: formatTime(modelSettingsState.savedAt) })
      : llm.configured
        ? tr('model.ready')
        : tr('model.keyMissing', { key: llm.keyEnv || selectedOption.keyEnv || tr('model.apiKey') });

  return `
    <div class="studio-card">
      <h3>${tr('model.title')}</h3>
      <form class="model-form" data-model-form>
        <label>
          ${tr('model.provider')}
          <select name="provider">
            ${providerOptions.map(([key, option]) => `
              <option value="${escapeHtml(key)}" ${key === provider ? 'selected' : ''}>${escapeHtml(option.label)}</option>
            `).join('')}
          </select>
        </label>
        <label>
          ${tr('model.modelName')}
          <input name="model" type="text" value="${escapeHtml(llm.model || selectedOption.defaultModel || '')}" placeholder="${escapeHtml(selectedOption.defaultModel || 'model name')}">
        </label>
        <label>
          ${tr('model.baseUrl')}
          <input name="baseUrl" type="url" value="${escapeHtml(llm.baseUrl || selectedOption.baseUrl || '')}" placeholder="${escapeHtml(selectedOption.baseUrl || 'https://api.example.com')}">
        </label>
        <label>
          ${tr('model.apiMode')}
          <select name="apiMode">
            <option value="chat_completions" ${llm.apiMode === 'chat_completions' ? 'selected' : ''}>${tr('model.chatCompletions')}</option>
            <option value="responses" ${llm.apiMode === 'responses' ? 'selected' : ''}>${tr('model.responses')}</option>
          </select>
        </label>
        <label>
          ${tr('model.apiKey')}
          <input name="apiKey" type="password" value="" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(llm.configured ? tr('model.keyKeepExisting') : tr('model.keyPlaceholder'))}">
          <small class="model-key-help">${tr('model.keyLocalNotice')}</small>
        </label>
        <div class="studio-row"><span>${tr('model.apiKey')}</span><strong>${llm.configured ? tr('model.keyAvailable') : escapeHtml(llm.keyEnv || selectedOption.keyEnv || tr('status.notConfigured'))}</strong></div>
        <div class="studio-row"><span>${tr('model.status')}</span><strong>${escapeHtml(statusText)}</strong></div>
        ${llm.lastChatError ? `<p class="studio-muted hint model-error">${tr('model.runtimeError')}</p>` : ''}
        <div class="studio-row"><span>${tr('chat.companion')}</span><strong>${tr('model.companionsUnchanged')}</strong></div>
        <button class="secondary-action" type="submit" ${modelSettingsState.saving ? 'disabled' : ''}>${tr(modelSettingsState.saving ? 'model.saving' : 'model.save')}</button>
      </form>
    </div>
  `;
}

function renderCategoryFields(selectedCategories = ['funny_videos', 'world_news', 'psychology']) {
  const defaults = new Set(selectedCategories);
  els.categoryFields.innerHTML = Object.entries(CATEGORY_LIBRARY).map(([key, item]) => `
    <label>
      <input type="checkbox" name="pushCategories" value="${key}" ${defaults.has(key) ? 'checked' : ''}>
      ${escapeHtml(formatCategory(key))}
    </label>
  `).join('');
}

function setProviderFields(selectedProviders = ['youtube', 'news', 'reddit', 'web_search']) {
  const selected = new Set(selectedProviders);
  Array.from(els.createForm.elements.enabledProviders || []).forEach((field) => {
    field.checked = selected.has(field.value);
  });
}

async function selectCompanion(id) {
  const current = activeCompanion();
  if (!id || id === current?.id) return;
  activeSupportSignal = null;
  wythUiState = setSupportPresence(wythUiState, 'none');
  const currentIndex = state.companions.findIndex((item) => item.id === current?.id);
  const nextIndex = state.companions.findIndex((item) => item.id === id);
  wythUiState = beginCompanionTransition(wythUiState, current?.id || '', id, nextIndex < currentIndex ? -1 : 1);
  const token = wythUiState.transition.token;
  syncShellState();
  if (!reduceMotion) await new Promise((resolve) => window.setTimeout(resolve, 180));
  if (wythUiState.transition.token !== token) return;
  state.selectedCompanionId = id;
  readReceipts = markCompanionRead(readReceipts, id);
  saveState();
  saveReadReceipts();
  render();
  await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 160 : 620));
  wythUiState = completeCompanionTransition(wythUiState, token);
  syncShellState();
  refreshMemoryStatus(id);
}

async function requestAssistantReply(companion, userMessage, priorMessages) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companion, userMessage, priorMessages })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.reply?.content) throw new Error(payload?.error || 'model_unavailable');
  runtimeStatus = {
    ...runtimeStatus,
    llm: {
      ...runtimeStatus.llm,
      lastChatSource: payload.source,
      lastChatAt: new Date().toISOString()
    }
  };
  return tagAssistantReplySource(payload.reply, payload.source);
}

async function refreshRuntimeStatus() {
  try {
    const response = await fetch('/api/health/ready');
    const payload = await response.json().catch(() => ({}));
    if (!payload?.llm) return;
    runtimeStatus = {
      ...runtimeStatus,
      llm: {
        ...runtimeStatus.llm,
        ...payload.llm,
        label: payload.llm.provider === 'deepseek' ? 'DeepSeek' : runtimeStatus.llm.label
      }
    };
    if (settingsState.surface === 'full') {
      const modelFormFocused = document.activeElement?.closest?.('[data-model-form]');
      if (!modelFormFocused && settingsState.activeSection === 'account') renderFullSettings(activeCompanion());
      return;
    }
    render({ preserveView: true });
  } catch {
    // Static preview mode has no status endpoint.
  }
}

async function saveModelSettings(form) {
  const data = new FormData(form);
  modelSettingsState = { saving: true, errorKey: '', savedAt: null };
  render();
  try {
    const response = await fetch('/api/model', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        provider: data.get('provider'),
        model: data.get('model'),
        baseUrl: data.get('baseUrl'),
        apiMode: data.get('apiMode'),
        apiKey: data.get('apiKey')
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Model save failed');
    runtimeStatus = {
      ...runtimeStatus,
      ...payload
    };
    modelSettingsState = { saving: false, errorKey: '', savedAt: new Date().toISOString() };
  } catch (error) {
    console.error('Wyth model settings save failed', error);
    modelSettingsState = {
      saving: false,
      errorKey: 'model.saveFailed',
      savedAt: null
    };
  }
  render();
}

async function refreshMemoryStatus(companionId = activeCompanion().id) {
  try {
    const response = await fetch(`/api/memory/${encodeURIComponent(companionId)}`);
    if (!response.ok) return;
    backendMemoryStatus = {
      ...backendMemoryStatus,
      [companionId]: await response.json()
    };
    render();
  } catch {
    // Static preview mode has no backend memory endpoint.
  }
}

async function clearActiveMemory() {
  const companion = activeCompanion();
  try {
    const response = await fetch(`/api/memory/${encodeURIComponent(companion.id)}`, {
      method: 'DELETE'
    });
    if (!response.ok) return;
    backendMemoryStatus = {
      ...backendMemoryStatus,
      [companion.id]: await response.json()
    };
    render();
  } catch {
    // Static preview mode has no backend memory endpoint.
  }
}

async function sendMessage(content) {
  if (!canSendChatMessage(chatUiState, content)) return;
  const companion = activeCompanion();
  const userMessage = createUserMessage(companion.id, content);
  const prior = companionMessages(companion.id);
  const updatedCompanion = updateMemory(companion, userMessage);

  state.companions = state.companions.map((item) => item.id === companion.id ? updatedCompanion : item);
  state.messages = [...state.messages, userMessage];
  chatUiState = beginChatSend(chatUiState, companion.id);
  saveState();
  render();

  let reply;
  try {
    reply = await requestAssistantReply(updatedCompanion, userMessage, prior);
  } catch (error) {
    chatUiState = completeChatSend(chatUiState, companion.id, chatFailureMessageKey(error?.message));
    render();
    await refreshRuntimeStatus();
    return;
  }
  const support = reply.metadata?.support || assessSupportSignal(
    [...prior, userMessage],
    { emotion: reply.metadata?.emotion }
  );
  state.messages = [...state.messages, reply];
  chatUiState = completeChatSend(chatUiState, companion.id);
  saveState();
  if (support.level !== 'none') showSupportPresence(support);
  else render();
  await refreshMemoryStatus(companion.id);
  await refreshRuntimeStatus();
}

async function retrieveSourcesFor(companion) {
  const sources = await retrieveContentForCompanion(companion, {
    proxyUrl: '/api/content'
  });
  return sources.length > 0 ? sources : null;
}

async function addDailyPick() {
  const companion = activeCompanion();
  const sources = await retrieveSourcesFor(companion);
  state.messages = [
    ...state.messages,
    createDailyPush(companion, {
      priorMessages: state.messages,
      ...(sources ? { sources } : {})
    })
  ];
  saveState();
  render();
}

function saveDailyPickFromAction(target) {
  const companion = activeCompanion();
  const pick = {
    sourceId: target.dataset.sourceId || '',
    title: target.dataset.title || 'Saved Daily Pick',
    url: target.dataset.url || '',
    summary: target.dataset.summary || '',
    sourceType: target.dataset.sourceType || '',
    savedAt: new Date().toISOString()
  };
  const key = pick.sourceId || pick.url || pick.title;
  const existing = savedPicks[companion.id] || [];
  savedPicks = {
    ...savedPicks,
    [companion.id]: [
      pick,
      ...existing.filter((item) => (item.sourceId || item.url || item.title) !== key)
    ].slice(0, 20)
  };
  saveSavedPicks();
  render();
}

function hideTranslateTrigger() {
  els.translateTrigger.hidden = true;
}

function hideTranslatePopover() {
  els.translatePopover.hidden = true;
  activeTranslation = null;
}

function authInvalidFieldFor(error) {
  if (error === 'invalid_email') return 'email';
  if (error === 'invalid_password' || error === 'invalid_credentials') return 'password';
  return '';
}

function focusAuthFeedback() {
  requestAnimationFrame(() => {
    const target = els.fullSettingsContent.querySelector('[aria-invalid="true"], .auth-error, .auth-notice, .auth-form input');
    target?.focus();
  });
}

async function authRequest(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(65_000)
    });
  } catch {
    throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable' });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('auth_failed'), { code: payload.error || 'auth_failed' });
  return payload;
}

async function refreshAuthStatus({ renderSettings = true } = {}) {
  let storageChanged = false;
  try {
    const payload = await authRequest('/api/auth/status');
    authUiState = reduceAuthState(authUiState, { type: 'STATUS', payload });
    const ownerId = payload.state === 'authenticated' ? payload.user?.id : '';
    storageChanged = switchLocalDataOwner(ownerId);
  } catch (error) {
    const connectionState = error.code === 'auth_unavailable'
      ? { configured: true, state: 'signed_out' }
      : error.code === 'auth_not_configured'
        ? { configured: false, state: 'signed_out' }
        : {};
    authUiState = reduceAuthState(authUiState, {
      type: 'ERROR',
      errorKey: authErrorKey(error.code),
      ...connectionState
    });
  }
  if (storageChanged) render();
  if (renderSettings && settingsState.surface === 'full' && settingsState.activeSection === 'account') renderFullSettings(activeCompanion());
}

async function handleAuthCallback() {
  const callback = parseAuthCallback(window.location.search);
  if (callback.kind === 'none') return 'none';
  history.replaceState(null, '', window.location.pathname);
  if (callback.kind === 'error') {
    const errorKey = callback.errorCode === 'expired'
      ? 'auth.error.expiredLink'
      : callback.errorCode === 'unavailable'
        ? 'auth.error.unavailable'
        : 'auth.error.failed';
    authUiState = reduceAuthState(authUiState, { type: 'ERROR', errorKey });
    return callback.kind;
  }
  await refreshAuthStatus({ renderSettings: false });
  if (callback.kind === 'recovery') {
    authUiState = reduceAuthState(authUiState, { type: 'MODE', mode: 'password' });
    openFullSettingsSurface('account');
    focusAuthFeedback();
  } else {
    authUiState = reduceAuthState(authUiState, { type: 'SUCCESS', noticeKey: 'auth.notice.confirmed' });
  }
  return callback.kind;
}

async function submitAuthForm(form) {
  const data = new FormData(form);
  const mode = form.dataset.authForm;
  authFormEmail = String(data.get('email') || authFormEmail || '').trim();
  authInvalidField = '';
  authUiState = reduceAuthState(authUiState, { type: 'BUSY' });
  renderFullSettings(activeCompanion());
  const wakeTimer = window.setTimeout(() => {
    if (!authUiState.busy) return;
    authUiState = { ...authUiState, noticeKey: 'auth.notice.waking' };
    renderFullSettings(activeCompanion());
  }, 2_500);
  try {
    if (mode === 'signup') {
      await authRequest('/api/auth/signup', { email: data.get('email'), password: data.get('password') });
      authUiState = reduceAuthState(authUiState, { type: 'SUCCESS', noticeKey: 'auth.notice.checkEmail' });
    } else if (mode === 'reset') {
      await authRequest('/api/auth/reset', { email: data.get('email') });
      authUiState = reduceAuthState(authUiState, { type: 'SUCCESS', noticeKey: 'auth.notice.resetSent' });
    } else if (mode === 'password') {
      await authRequest('/api/auth/password', { password: data.get('password') });
      await refreshAuthStatus({ renderSettings: false });
      authUiState = { ...authUiState, mode: 'login', noticeKey: 'auth.notice.passwordSaved' };
    } else {
      const loginPayload = await authRequest('/api/auth/login', { email: data.get('email'), password: data.get('password') });
      const loginStatus = authenticatedStatusFromLogin(loginPayload);
      if (!loginStatus) throw Object.assign(new Error('auth_failed'), { code: 'auth_failed' });
      authUiState = reduceAuthState(authUiState, { type: 'STATUS', payload: loginStatus });
      if (switchLocalDataOwner(loginStatus.user.id)) render();
    }
  } catch (error) {
    authInvalidField = authInvalidFieldFor(error.code);
    authUiState = reduceAuthState(authUiState, { type: 'ERROR', errorKey: authErrorKey(error.code) });
  }
  window.clearTimeout(wakeTimer);
  renderFullSettings(activeCompanion());
  focusAuthFeedback();
}

async function logoutAccount() {
  authUiState = reduceAuthState(authUiState, { type: 'BUSY' });
  renderFullSettings(activeCompanion());
  try {
    await authRequest('/api/auth/logout', {});
    if (switchLocalDataOwner('')) render();
    await refreshAuthStatus({ renderSettings: false });
  } catch (error) {
    authUiState = reduceAuthState(authUiState, { type: 'ERROR', errorKey: authErrorKey(error.code) });
  }
  renderFullSettings(activeCompanion());
}

async function retryAuthConnection({ focusFeedback = true } = {}) {
  if (authUiState.busy) return;
  authUiState = reduceAuthState(authUiState, { type: 'BUSY' });
  renderFullSettings(activeCompanion());
  await refreshAuthStatus({ renderSettings: true });
  if (focusFeedback) focusAuthFeedback();
}

function dismissSelectionActions({ clearSelection = false } = {}) {
  hideTranslateTrigger();
  hideTranslatePopover();
  pendingSelection = null;
  if (clearSelection) window.getSelection()?.removeAllRanges();
}

function handleMessageSelection() {
  if (activeSupportSignal?.suppressLearning) {
    dismissSelectionActions({ clearSelection: true });
    return;
  }
  const selection = window.getSelection();
  const text = selection?.toString().trim() || '';
  if (!text || text.length > 2000 || !selection || selection.rangeCount === 0) {
    dismissSelectionActions();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!els.messageList.contains(range.commonAncestorContainer)) {
    dismissSelectionActions();
    return;
  }
  const anchorElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const rect = range.getBoundingClientRect();
  pendingSelection = {
    text,
    context: anchorElement?.closest('.message')?.querySelector('p')?.textContent?.trim().slice(0, 300) || '',
    anchor: {
      top: rect.top,
      left: rect.left + rect.width / 2,
      bottom: rect.bottom
    }
  };
  els.translateTrigger.style.top = `${Math.max(rect.top - 52, 8)}px`;
  els.translateTrigger.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70)}px`;
  els.translateTrigger.hidden = false;
}

function positionTranslatePopover(anchor) {
  const width = Math.min(340, window.innerWidth - 32);
  const left = Math.min(Math.max(anchor.left - width / 2, 16), window.innerWidth - width - 16);
  const top = anchor.bottom + 8 + 320 > window.innerHeight
    ? Math.max(anchor.top - 8 - 280, 16)
    : anchor.bottom + 8;
  els.translatePopover.style.left = `${left}px`;
  els.translatePopover.style.top = `${top}px`;
}

function renderTranslatePopover(view) {
  const { status, selection, payload } = view;
  const header = `
    <div class="popover-header">
      <span class="selected-text">${escapeHtml(selection.text)}</span>
      <button class="popover-close" type="button" data-action="close-popover" aria-label="${escapeHtml(tr('accessibility.closeTranslation'))}">x</button>
    </div>
  `;

  if (status === 'loading') {
    els.translatePopover.innerHTML = `${header}<p class="popover-status">${tr('languageAction.translating')}</p>`;
    return;
  }

  if (status === 'error' || !payload?.result) {
    els.translatePopover.innerHTML = `${header}<p class="popover-status">${tr('languageAction.translationUnavailable')}</p>`;
    return;
  }

  const { result } = payload;
  const alreadySaved = vocabBook.some((entry) => entry.text.toLowerCase() === selection.text.toLowerCase());
  els.translatePopover.innerHTML = `
    ${header}
    ${result.pronunciation ? `<p class="pronunciation">${escapeHtml(result.pronunciation)}</p>` : ''}
    ${result.translation
      ? `<p class="translation">${escapeHtml(result.translation)}</p>`
      : ''}
    ${result.explanation ? `<p class="explanation">${escapeHtml(result.explanation)}</p>` : ''}
    ${result.examples?.length > 0 ? `
      <div class="example-list">
        ${result.examples.map((item) => `<div class="example-item">${escapeHtml(item)}</div>`).join('')}
      </div>
    ` : ''}
    ${payload.source === 'llm' ? `
      <div class="popover-actions">
        <button class="save-vocab" type="button" data-action="save-vocab" ${alreadySaved ? 'disabled' : ''}>
          ${tr(alreadySaved ? 'vocabulary.saved' : 'vocabulary.save')}
        </button>
      </div>
    ` : ''}
  `;
}

async function openTranslatePopover(selection) {
  hideTranslateTrigger();
  window.getSelection()?.removeAllRanges();
  activeTranslation = null;
  positionTranslatePopover(selection.anchor);
  renderTranslatePopover({ status: 'loading', selection });
  els.translatePopover.hidden = false;

  // The user's native language is Chinese, so a selection in the companion's
  // practice language should be explained in Chinese. Only when the user
  // selects their own Chinese text do we translate the other way, into the
  // companion's language. Japanese/Korean companions use Han characters, so we
  // don't treat Han script as "Chinese the user typed" for them.
  const companion = activeCompanion();
  const companionLanguage = companion?.language || 'english';
  const companionUsesHan = ['japanese', 'korean'].includes(companionLanguage);
  const looksChinese = /[一-鿿]/.test(selection.text) && !companionUsesHan;
  const targetLanguage = looksChinese
    ? (LANGUAGE_LIBRARY[companionLanguage]?.translateTarget || 'English')
    : 'Chinese';

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        text: selection.text,
        context: selection.context,
        targetLanguage
      })
    });
    const payload = await response.json();
    if (!response.ok || payload?.error) throw new Error(payload?.error || 'Translate failed');
    if (els.translatePopover.hidden) return;
    activeTranslation = { selection, payload };
    renderTranslatePopover({ status: 'ready', selection, payload });
  } catch {
    if (els.translatePopover.hidden) return;
    renderTranslatePopover({ status: 'error', selection });
  }
}

async function openNaturalAssist(selection) {
  hideTranslateTrigger();
  positionTranslatePopover(selection.anchor);
  els.translatePopover.hidden = false;
  els.translatePopover.innerHTML = `<p class="popover-status">${tr('languageAction.naturalLoading')}</p>`;
  try {
    const response = await fetch('/api/language-assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: selection.text, context: selection.context, language: formatLanguage(activeCompanion()?.language) })
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || 'Language assist failed');
    els.translatePopover.innerHTML = `
      <div class="popover-header"><span class="selected-text">${tr('languageAction.naturalTitle')}</span><button class="popover-close" type="button" data-action="close-popover" aria-label="${escapeHtml(tr('languageAction.close'))}">x</button></div>
      <p class="natural-alternative">${escapeHtml(payload.result.naturalAlternative)}</p>
      <p class="explanation">${escapeHtml(payload.result.note || '')}</p>
    `;
  } catch {
    els.translatePopover.innerHTML = `<p class="popover-status">${tr('languageAction.naturalUnavailable')}</p>`;
  }
}

function speakSelection(selection) {
  hideTranslateTrigger();
  if (!settingsState.quick.soundEnabled) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(selection.text);
  window.speechSynthesis.speak(utterance);
}

function localizedAvatarError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('png') || message.includes('jpeg') || message.includes('webp')) return tr('avatar.error.type');
  if (message.includes('6 mb') || message.includes('smaller')) return tr('avatar.error.tooLarge');
  if (message.includes('read')) return tr('avatar.error.decode');
  return tr('avatar.error.processing');
}

function saveActiveTranslation() {
  if (!activeTranslation?.payload?.result) return;
  const { selection, payload } = activeTranslation;
  vocabBook = addVocabEntry(vocabBook, {
    text: selection.text,
    translation: payload.result.translation,
    pronunciation: payload.result.pronunciation,
    explanation: payload.result.explanation,
    examples: payload.result.examples,
    companionId: activeCompanion()?.id || '',
    targetLanguage: payload.targetLanguage || ''
  });
  saveVocabBook();
  renderTranslatePopover({ status: 'ready', selection, payload });
  render();
}

function showBrowserNotifications(notifications = []) {
  if (!notificationPreferences.enabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const item of notifications.slice(0, 3)) {
    try {
      // eslint-disable-next-line no-new
      new Notification(item.title, { body: item.body });
    } catch {
      // Some environments (e.g. insecure origins) block constructor use.
      return;
    }
  }
}

async function requestNotificationPermission() {
  if (notificationPermissionPending) return notificationPreferences.permission;
  notificationPermissionPending = true;
  if (typeof Notification === 'undefined') {
    persistNotificationPreferences({ ...notificationPreferences, enabled: false, permission: 'unsupported' });
    notificationPermissionPending = false;
    renderCurrentSettingsSurface();
    return 'unsupported';
  }
  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      const next = {
        ...notificationPreferences,
        enabled: permission === 'granted',
        permission
      };
      persistNotificationPreferences(next);
    } catch {
      persistNotificationPreferences({ ...notificationPreferences, enabled: false, permission: Notification.permission });
    }
  } else {
    persistNotificationPreferences({
      ...notificationPreferences,
      enabled: Notification.permission === 'granted',
      permission: Notification.permission
    });
  }
  notificationPermissionPending = false;
  renderCurrentSettingsSurface();
  return notificationPreferences.permission;
}

function renderCurrentSettingsSurface() {
  if (settingsState.surface === 'full') renderFullSettings(activeCompanion());
  else if (activeDrawer === 'settings') renderQuickSettings();
}

function toggleNotificationPreference() {
  if (notificationPermissionPending || ['denied', 'unsupported'].includes(notificationPreferences.permission)) return;
  if (notificationPreferences.permission === 'default') {
    requestNotificationPermission();
    renderCurrentSettingsSurface();
    return;
  }
  const next = { ...notificationPreferences, enabled: !notificationPreferences.enabled };
  persistNotificationPreferences(next);
  renderCurrentSettingsSurface();
}

function toggleQuietHoursPreference() {
  const next = {
    ...notificationPreferences,
    quietHours: { ...notificationPreferences.quietHours, enabled: !notificationPreferences.quietHours.enabled }
  };
  persistNotificationPreferences(next);
  renderCurrentSettingsSurface();
}

async function runLocalScheduler(now = new Date()) {
  const timezoneOffsetMinutes = -now.getTimezoneOffset();
  const dueCompanions = companionsDueForPush(state, { now: now.toISOString(), timezoneOffsetMinutes });
  const sourcesByCompanion = {};
  for (const companion of dueCompanions) {
    const sources = await retrieveSourcesFor(companion);
    if (sources) sourcesByCompanion[companion.id] = sources;
  }
  const result = runScheduledDailyPushes(state, {
    now: now.toISOString(),
    notificationPreferences,
    proactiveContactOverride: settingsState.quick.proactiveContact,
    timezoneOffsetMinutes,
    sourcesByCompanion
  });
  if (!hasSchedulerStateChanged(state, result)) return false;
  state = {
    ...result,
    notifications: undefined
  };
  schedulerStatus = {
    lastRunAt: now.toISOString(),
    lastNotifications: result.notifications,
    lastSourceMode: Object.keys(sourcesByCompanion).length > 0 ? 'external' : 'mock'
  };
  showBrowserNotifications(result.notifications);
  saveState();
  render({ preserveView: true, skipSettings: Boolean(activeDrawer) || settingsState.surface === 'full' });
  return true;
}

function openCompanionDialog(mode = 'create') {
  avatarRequestState = { session: avatarRequestState.session + 1, token: avatarRequestState.token + 1 };
  if (mode === 'edit') {
    const companion = activeCompanion();
    editingCompanionId = companion.id;
    pendingAvatar = companion.avatar || null;
    creationFlow = createCreationFlow({ mode: 'advanced', draft: {
      name: companion.name,
      relationshipType: companion.relationshipType,
      personality: companion.personality,
      backgroundStory: companion.backgroundStory,
      language: companion.language,
      sceneId: companion.sceneId,
      avatar: companion.avatar,
      visualStyle: companion.visualStyle,
      voiceId: companion.voiceId
    } });
    els.saveCompanionButton.textContent = tr('creation.saveChanges');
  } else {
    editingCompanionId = null;
    pendingAvatar = null;
    creationFlow = createCreationFlow();
    creationPresetId = 'friend';
    els.saveCompanionButton.textContent = tr('creation.createAndChat');
  }
  syncFormFromCreationDraft();
  resetAvatarFileInputs();
  setAvatarError('');
  syncMinorCreationRestrictions();
  renderCreationFlow();
  renderAvatarDraft();
  renderCompanionPreview();
  els.createDialog.showModal();
  requestAnimationFrame(() => (mode === 'edit' ? els.createForm.elements.advancedName : els.createForm.elements.name)?.focus());
}

const ROMANTIC_RELATIONSHIPS = new Set(['Girlfriend', 'Boyfriend']);

function normalizeRelationshipForAge(value, fallback = 'Bestie') {
  return normalizeRelationshipForAgeState(value, state.user.ageGroup, fallback);
}

function syncMinorCreationRestrictions() {
  const select = els.createForm.elements.relationshipType;
  const current = activeCompanion()?.relationshipType || 'Bestie';
  for (const option of select.options) {
    if (ROMANTIC_RELATIONSHIPS.has(option.value)) option.disabled = state.user.ageGroup === 'minor';
  }
  if (state.user.ageGroup === 'minor' && ROMANTIC_RELATIONSHIPS.has(select.value)) {
    select.value = normalizeRelationshipForAge(select.value, current);
  }
}

const CREATION_STEP_KEYS = {
  identity: 'creation.identityStep',
  relationship: 'creation.relationshipStep',
  personality: 'creation.personalityStep',
  story: 'creation.storyStep',
  language: 'creation.languageStep',
  voice_scene: 'creation.voiceSceneStep',
  review: 'creation.reviewStep'
};

function creationDraftFromForm() {
  const data = new FormData(els.createForm);
  const advanced = creationFlow.mode === 'advanced';
  return {
    name: advanced ? data.get('advancedName') : data.get('name'),
    relationshipType: data.get('relationshipType'),
    personality: data.get('personality'),
    backgroundStory: data.get('backgroundStory'),
    language: data.get('language'),
    sceneId: data.get('sceneId'),
    avatar: pendingAvatar,
    visualStyle: selectVisualStyle(creationFlow.draft.visualStyle, data.get('visualStyle')),
    voiceId: creationFlow.draft.voiceId
  };
}

function syncVisibleCreationDraft() {
  creationFlow = updateCreationDraft(creationFlow, creationDraftFromForm());
  return creationFlow;
}

function syncFormFromCreationDraft() {
  const { draft } = creationFlow;
  for (const key of ['relationshipType', 'personality', 'backgroundStory', 'language', 'sceneId']) {
    if (els.createForm.elements[key]) els.createForm.elements[key].value = draft[key] || '';
  }
  els.createForm.elements.name.value = draft.name || '';
  els.createForm.elements.advancedName.value = draft.name || '';
  els.createForm.elements.presetId.value = creationPresetId;
  for (const field of els.createForm.elements.visualStyle) field.checked = false;
  const visual = els.createForm.querySelector(`[name="visualStyle"][value="${draft.visualStyle}"]:not(:disabled)`);
  if (visual) visual.checked = true;
}

function resetAvatarFileInputs() {
  for (const field of [els.createForm.elements.avatarFile, els.createForm.elements.advancedAvatarFile]) {
    if (field) field.value = '';
  }
}

function invalidateAvatarRequests() {
  avatarRequestState = beginAvatarRequest(avatarRequestState);
}

function renderCreationReview() {
  const { draft } = creationFlow;
  els.creationReview.innerHTML = `
    <dl>
      <div><dt>${tr('creation.name')}</dt><dd>${escapeHtml(draft.name)}</dd></div>
      <div><dt>${tr('creation.avatarStatus')}</dt><dd>${escapeHtml(tr(draft.avatar?.kind === 'custom' ? 'avatar.customReady' : 'avatar.defaultReady'))}</dd></div>
      <div><dt>${tr('creation.relationship')}</dt><dd>${escapeHtml(formatRelationship(draft.relationshipType))}</dd></div>
      <div><dt>${tr('creation.personality')}</dt><dd>${escapeHtml(draft.personality)}</dd></div>
      <div><dt>${tr('creation.backgroundStory')}</dt><dd>${escapeHtml(draft.backgroundStory || tr('common.notSet'))}</dd></div>
      <div><dt>${tr('creation.practiceLanguage')}</dt><dd>${escapeHtml(formatLanguage(draft.language))}</dd></div>
      <div><dt>${tr('creation.scene')}</dt><dd>${escapeHtml(formatSceneLabel(draft.sceneId))}</dd></div>
      <div><dt>${tr('creation.avatarStyle')}</dt><dd>${escapeHtml(formatVisualStyle(draft.visualStyle))}</dd></div>
      <div><dt>${tr('creation.voice')}</dt><dd>${escapeHtml(draft.voiceId || tr('common.comingSoon'))}</dd></div>
    </dl>`;
}

function formatRelationship(value) {
  const key = ID_TO_TRANSLATION_KEY.relationship?.[value];
  return key ? tr(key) : value;
}

function formatVisualStyle(value) {
  const keys = { cinematic_semireal: 'creation.visualStyle.cinematic', digital_human: 'creation.visualStyle.realistic', illustration: 'creation.visualStyle.illustrated' };
  return tr(keys[value] || 'creation.visualStyle.cinematic');
}

function formatSceneLabel(value) {
  const keys = { friend_room: 'creation.scene.friendRoom', listener_rain: 'creation.scene.listenerRain', traveler_train: 'creation.scene.travelerTrain', workmate_desk: 'creation.scene.workmateDesk', coach_study: 'creation.scene.coachStudy' };
  return tr(keys[value] || 'creation.scene.friendRoom');
}

function renderCreationFlow(focus = false) {
  const advanced = creationFlow.mode === 'advanced';
  els.createDialog.classList.toggle('is-advanced', advanced);
  els.quickCreation.hidden = advanced;
  els.advancedCreation.hidden = !advanced;
  els.creationStepper.hidden = !advanced;
  els.createForm.querySelector('[data-creation-action="advanced"]').hidden = advanced;
  els.createForm.querySelector('[data-creation-action="quick"]').hidden = !advanced;
  els.createForm.querySelector('[data-creation-action="back"]').hidden = !advanced || creationFlow.step === 'identity';
  els.createForm.querySelector('[data-creation-action="next"]').hidden = !advanced || creationFlow.step === 'review';
  els.saveCompanionButton.hidden = advanced && creationFlow.step !== 'review';
  const showPreview = !advanced || creationFlow.step === 'review';
  els.creationPreviewPanel.hidden = !showPreview;
  els.creationStepHeading.textContent = advanced ? tr(CREATION_STEP_KEYS[creationFlow.step]) : tr('creation.quick.title');
  const unavailableVisual = creationFlow.draft.visualStyle !== 'cinematic_semireal';
  els.currentVisualStatus.hidden = !unavailableVisual;
  els.currentVisualStatus.textContent = unavailableVisual
    ? `${formatVisualStyle(creationFlow.draft.visualStyle)} · ${tr('creation.preservedComingSoon')}`
    : '';
  els.currentVoiceStatus.hidden = !creationFlow.draft.voiceId;
  els.currentVoiceStatus.textContent = creationFlow.draft.voiceId
    ? `${creationFlow.draft.voiceId} · ${tr('creation.preservedComingSoon')}`
    : '';
  els.creationStepper.innerHTML = ADVANCED_STEPS.map((step) => `<li${step === creationFlow.step ? ' aria-current="step"' : ''}>${escapeHtml(tr(CREATION_STEP_KEYS[step]))}</li>`).join('');
  els.advancedCreation.querySelectorAll('[data-creation-step]').forEach((section) => {
    section.hidden = section.dataset.creationStep !== creationFlow.step;
  });
  if (creationFlow.step === 'review') renderCreationReview();
  renderAvatarDraft();
  if (focus) requestAnimationFrame(() => {
    els.creationStepHeading.focus();
    const current = els.advancedCreation.querySelector(`[data-creation-step="${creationFlow.step}"]`);
    current?.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')?.focus();
  });
}

function moveCreationStep(direction) {
  syncVisibleCreationDraft();
  if (direction > 0) {
    const validation = validateCreationStep(creationFlow, { ageGroup: state.user.ageGroup });
    if (!validation.ok) {
      els.creationError.textContent = tr(`creation.validation.${validation.error}`);
      els.createForm.elements[validation.field]?.focus();
      if (validation.field === 'name') els.createForm.elements.advancedName.focus();
      return;
    }
  }
  els.creationError.textContent = '';
  const current = ADVANCED_STEPS.indexOf(creationFlow.step);
  const next = ADVANCED_STEPS[current + direction];
  if (!next) return;
  creationFlow = goToCreationStep(creationFlow, next);
  renderCreationFlow(true);
}

function deleteActiveCompanion() {
  if (state.companions.length <= 1) return;
  const companion = activeCompanion();
  state.companions = state.companions.filter((item) => item.id !== companion.id);
  state.messages = state.messages.filter((message) => message.companionId !== companion.id);
  state.selectedCompanionId = state.companions[0].id;
  saveState();
  render();
}

function companionInputFromForm(form) {
  const data = new FormData(form);
  const preset = WYTH_PRESETS.find((item) => item.id === data.get('presetId')) || WYTH_PRESETS[0];
  return {
    name: creationFlow.draft.name,
    relationshipType: normalizeRelationshipForAge(
      data.get('relationshipType') || preset.relationshipType,
      editingCompanionId ? activeCompanion()?.relationshipType : 'Bestie'
    ),
    personality: data.get('personality') || preset.personality,
    backgroundStory: data.get('backgroundStory'),
    language: data.get('language') || 'english',
    sceneId: data.get('sceneId') || preset.sceneId,
    visualStyle: creationFlow.draft.visualStyle,
    voiceId: creationFlow.draft.voiceId,
    avatar: pendingAvatar,
    careStyle: editingCompanionId ? activeCompanion()?.careStyle : preset.careStyle,
    practiceStyle: editingCompanionId ? activeCompanion()?.practiceStyle : undefined,
    contentSources: editingCompanionId ? activeCompanion()?.contentSources : undefined,
    customKeywords: editingCompanionId ? activeCompanion()?.customKeywords : undefined,
    pushCategories: editingCompanionId ? activeCompanion()?.pushCategories : undefined,
    pushSchedule: editingCompanionId ? activeCompanion()?.pushSchedule : undefined,
    memoryEnabled: editingCompanionId ? activeCompanion()?.memoryEnabled : true
  };
}

function renderCompanionPreview() {
  if (!els.companionPreview) return;
  const preview = generateCompanionPreview(companionInputFromForm(els.createForm));
  els.companionPreview.innerHTML = preview.messages
    .filter((message) => ['user', 'assistant'].includes(message.role))
    .map((message) => {
    const label = message.role === 'user' ? tr('chat.you') : preview.companion.name;
    return `
      <article class="preview-message ${message.role}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(message.content)}</span>
      </article>
    `;
  }).join('');
}

function openProfileDialog() {
  els.profileForm.elements.displayName.value = state.user.displayName;
  els.profileForm.elements.email.value = state.user.email;
  els.profileForm.elements.allowAiTraining.checked = state.user.privacy.allowAiTraining;
  els.profileForm.elements.showPrivacyNotice.checked = state.user.privacy.showPrivacyNotice;
  els.profileBirthday.value = state.user.birthday || '';
  els.profileBirthday.max = localCalendarDate();
  els.profileBirthdayError.textContent = '';
  els.profileBirthday.removeAttribute('aria-invalid');
  els.profileDialog.showModal();
}

function saveProfileFromForm(form) {
  const data = new FormData(form);
  let nextOnboarding = onboarding;
  const requestedBirthday = String(data.get('birthday') || '').trim();
  if (requestedBirthday) {
    const normalized = normalizeBirthday(requestedBirthday, localCalendarDate());
    if (!normalized.ok) {
      const key = normalized.error === 'future_date'
        ? 'onboarding.birthday.future'
        : normalized.error === 'age_out_of_range'
          ? 'onboarding.birthday.ageRange'
          : 'onboarding.birthday.invalid';
      els.profileBirthday.setAttribute('aria-invalid', 'true');
      els.profileBirthdayError.textContent = tr(key);
      return;
    }
    nextOnboarding = saveBirthday(nextOnboarding, requestedBirthday, localCalendarDate());
  }
  const nextState = { ...state, user: updateUserProfile(state.user, {
    displayName: data.get('displayName'),
    email: data.get('email'),
    birthday: nextOnboarding.birthday || state.user.birthday,
    privacy: {
      localOnly: true,
      allowAiTraining: data.get('allowAiTraining') === 'on',
      showPrivacyNotice: data.get('showPrivacyNotice') === 'on'
    }
  }) };
  if (!persistNextInterfaceState(nextOnboarding, nextState)) {
    els.profileBirthdayError.textContent = tr('error.storageUnavailable');
    return;
  }
  if (state.user.birthday) profilePromptDismissed = true;
  els.profileDialog.close();
  render();
}

function saveCompanionFromForm(form) {
  const input = companionInputFromForm(form);
  if (!String(input.name || '').trim()) {
    els.creationError.textContent = tr('creation.nameRequired');
    (creationFlow.mode === 'advanced' ? form.elements.advancedName : form.elements.name).focus();
    return;
  }
  els.creationError.textContent = '';

  if (editingCompanionId) {
    state.companions = state.companions.map((companion) => (
      companion.id === editingCompanionId ? updateCompanion(companion, input) : companion
    ));
    saveState();
    editingCompanionId = null;
    pendingAvatar = null;
    invalidateAvatarRequests();
    resetAvatarFileInputs();
    els.createDialog.close();
    render();
    return;
  }

  const companion = createCompanion(input);
  const nextState = { ...state, companions: [...state.companions, companion], messages: [
    ...state.messages,
    {
      id: `msg_${companion.id}_welcome`,
      companionId: companion.id,
      role: 'assistant',
      content: buildWelcomeContent(companion),
      createdAt: new Date().toISOString()
    }
  ], selectedCompanionId: companion.id };
  const nextOnboarding = { ...onboarding, stage: 'complete', completed: true };
  if (!persistNextInterfaceState(nextOnboarding, nextState)) return;
  form.reset();
  pendingAvatar = null;
  invalidateAvatarRequests();
  resetAvatarFileInputs();
  renderCompanionPreview();
  els.createDialog.close();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function linkify(value) {
  return value.replace(/(https:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatChatSource(source) {
  if (source === 'llm') return 'LLM';
  if (source === 'local_fallback') return tr('chat.sourceFallback');
  return tr('chat.ready');
}

function safeHttpUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

els.companionList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-companion-id]');
  if (card) selectCompanion(card.dataset.companionId);
});

els.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const content = els.messageInput.value.trim();
  if (!canSendChatMessage(chatUiState, content)) return;
  els.messageInput.value = '';
  sendMessage(content);
});

els.messageList.addEventListener('mouseup', () => {
  window.setTimeout(() => {
    if (ignoreSelectionUntilPointerUp) return;
    handleMessageSelection();
  }, 0);
});
els.messageForm.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="stay-with-me"]');
  if (!button) return;
  showSupportPresence(requestManualSupport(), button);
});
els.companionPresence.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="dismiss-support"]')) dismissSupportPresence();
});
els.messageList.addEventListener('scroll', () => {
  const distanceFromBottom = els.messageList.scrollHeight - els.messageList.scrollTop - els.messageList.clientHeight;
  const nextReading = distanceFromBottom > 80;
  if (nextReading === wythUiState.historyReading) return;
  wythUiState = setHistoryReading(wythUiState, nextReading);
  syncShellState();
});

els.translateTrigger.addEventListener('mousedown', (event) => {
  event.preventDefault();
});
els.translateTrigger.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-language-action]');
  const action = actionButton?.dataset.languageAction;
  if (!pendingSelection || !action) return;
  const selected = pendingSelection;
  if (action === 'translate') openTranslatePopover(selected);
  if (action === 'natural') openNaturalAssist(selected);
  if (action === 'speak') speakSelection(selected);
});

els.translatePopover.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (action === 'close-popover') hideTranslatePopover();
  if (action === 'save-vocab') saveActiveTranslation();
});

document.addEventListener('pointerdown', (event) => {
  if (els.translateTrigger.hidden && els.translatePopover.hidden) return;
  if (els.translateTrigger.contains(event.target) || els.translatePopover.contains(event.target)) return;
  ignoreSelectionUntilPointerUp = true;
  dismissSelectionActions({ clearSelection: true });
});

document.addEventListener('pointerup', () => {
  window.setTimeout(() => {
    ignoreSelectionUntilPointerUp = false;
  }, 0);
});

document.addEventListener('selectionchange', () => {
  if (!els.translatePopover.hidden) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.toString().trim()) {
    dismissSelectionActions();
  }
});

document.addEventListener('keydown', (event) => {
  trapFullSettingsFocus(event);
  if (event.key === 'Escape') {
    if (els.profileDialog.open || els.createDialog.open) return;
    hideTranslateTrigger();
    hideTranslatePopover();
    if (settingsState.surface === 'full') {
      closeFullSettings();
      return;
    }
    if (activeDrawer) closeUtilityDrawer();
  }
});

els.studioPanel.addEventListener('click', (event) => {
  const localeButton = event.target.closest('[data-locale]');
  if (localeButton) {
    changeInterfaceLocale(localeButton.dataset.locale, 'drawer');
    return;
  }
  const action = event.target.dataset.action;
  const setting = event.target.dataset.setting;
  if (setting === 'soundEnabled') {
    const nextSettings = updateQuickSetting(settingsState, setting, !settingsState.quick.soundEnabled);
    commitSettingsState(nextSettings);
    renderQuickSettings();
    return;
  }
  if (action === 'daily-pick') addDailyPick();
  if (action === 'run-scheduler') runLocalScheduler();
  if (action === 'delete-companion') deleteActiveCompanion();
  if (action === 'edit-companion') openCompanionDialog('edit');
  if (action === 'stop-category') {
    const companion = activeCompanion();
    state.companions = state.companions.map((item) => (
      item.id === companion.id ? stopPushCategory(item, event.target.dataset.category) : item
    ));
    saveState();
    render();
  }
  if (action === 'save-pick') saveDailyPickFromAction(event.target);
  if (action === 'remove-vocab') {
    vocabBook = removeVocabEntry(vocabBook, event.target.dataset.vocabId);
    saveVocabBook();
    render();
  }
  if (action === 'toggle-notifications') {
    toggleNotificationPreference();
  }
  if (action === 'toggle-quiet-hours') {
    toggleQuietHoursPreference();
  }
  if (action === 'edit-profile') openProfileDialog();
  if (action === 'complete-profile') openProfileDialog();
  if (action === 'dismiss-profile-prompt') {
    profilePromptDismissed = true;
    renderStudio(activeCompanion());
  }
  if (action === 'clear-memory') clearActiveMemory();
  if (action === 'toggle-training') {
    state.user = updateUserProfile(state.user, {
      privacy: {
        allowAiTraining: !state.user.privacy.allowAiTraining
      }
    });
    saveState();
    render();
  }
  if (action === 'toggle-reduced-motion') {
    const nextReduceMotion = !reduceMotion;
    const nextSettings = updateQuickSetting(settingsState, 'reduceMotion', nextReduceMotion);
    if (!commitSettingsState(nextSettings)) {
      renderQuickSettings();
      return;
    }
    reduceMotion = nextReduceMotion;
    localStorage.setItem(MOTION_KEY, String(reduceMotion));
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    renderStudio(activeCompanion());
  }
  if (action === 'open-full-settings') openFullSettingsSurface();
  if (action === 'open-vocabulary') {
    closeFullSettings();
    openUtilityDrawer('vocabulary');
  }
});
els.studioPanel.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-model-form]');
  if (!form) return;
  event.preventDefault();
  saveModelSettings(form);
});
els.studioPanel.addEventListener('change', (event) => {
  const setting = event.target.dataset.setting;
  if (setting) {
    const nextSettings = updateQuickSetting(settingsState, setting, event.target.value);
    if (!commitSettingsState(nextSettings)) {
      renderQuickSettings();
      return;
    }
    if (setting === 'readingMode') {
      wythUiState = setReadingMode(wythUiState, settingsState.quick.readingMode);
      syncShellState();
    }
    renderQuickSettings();
    return;
  }
  if (event.target.name !== 'provider') return;
  const form = event.target.closest('[data-model-form]');
  const option = runtimeStatus.modelOptions?.[event.target.value];
  if (!form || !option) return;
  form.elements.model.value = option.defaultModel || '';
  form.elements.baseUrl.value = option.baseUrl || '';
  form.elements.apiMode.value = option.apiMode || 'chat_completions';
});

els.utilityDock.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="open-drawer"]');
  if (!button) return;
  drawerTrigger = button;
  if (button.dataset.drawer === 'create') {
    openCompanionDialog('create');
    return;
  }
  openUtilityDrawer(button.dataset.drawer);
});

els.fullSettings.addEventListener('click', (event) => {
  const authModeButton = event.target.closest('[data-auth-mode]');
  if (authModeButton) {
    authInvalidField = '';
    authUiState = reduceAuthState(authUiState, { type: 'MODE', mode: authModeButton.dataset.authMode });
    renderFullSettings(activeCompanion());
    els.fullSettingsContent.querySelector('input')?.focus();
    return;
  }
  const sectionButton = event.target.closest('[data-settings-section]');
  if (sectionButton) {
    settingsState = selectFullSettingsSection(settingsState, sectionButton.dataset.settingsSection);
    renderFullSettings(activeCompanion());
    els.fullSettingsContent.querySelector('h3')?.focus();
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'edit-profile') openProfileDialog();
  if (action === 'auth-logout') logoutAccount();
  if (action === 'auth-retry') retryAuthConnection();
  if (action === 'edit-companion') openCompanionDialog('edit');
  if (action === 'delete-companion') deleteActiveCompanion();
  if (action === 'daily-pick') addDailyPick();
  if (action === 'run-scheduler') runLocalScheduler();
  if (action === 'stop-category') {
    const companion = activeCompanion();
    state.companions = state.companions.map((item) => (
      item.id === companion.id ? stopPushCategory(item, actionButton.dataset.category) : item
    ));
    saveState();
    renderFullSettings(activeCompanion());
  }
  if (action === 'remove-vocab') {
    vocabBook = removeVocabEntry(vocabBook, actionButton.dataset.vocabId);
    saveVocabBook();
    renderFullSettings(activeCompanion());
  }
  if (action === 'clear-memory') clearActiveMemory();
  if (action === 'toggle-notifications') {
    toggleNotificationPreference();
  }
  if (action === 'toggle-quiet-hours') {
    toggleQuietHoursPreference();
  }
  if (action === 'toggle-training') {
    state.user = updateUserProfile(state.user, { privacy: { allowAiTraining: !state.user.privacy.allowAiTraining } });
    saveState();
    renderFullSettings(activeCompanion());
  }
  if (action === 'open-vocabulary') {
    closeFullSettings();
    openUtilityDrawer('vocabulary');
  }
});
els.fullSettings.addEventListener('submit', (event) => {
  const authForm = event.target.closest('[data-auth-form]');
  if (authForm) {
    event.preventDefault();
    submitAuthForm(authForm);
    return;
  }
  const form = event.target.closest('[data-model-form]');
  if (!form) return;
  event.preventDefault();
  saveModelSettings(form);
});
els.fullSettings.addEventListener('change', (event) => {
  const notificationSetting = event.target.dataset.notificationSetting;
  if (notificationSetting) {
    const key = notificationSetting === 'quietStart' ? 'start' : 'end';
    const next = normalizeNotificationPreferences({
      ...notificationPreferences,
      quietHours: { ...notificationPreferences.quietHours, [key]: event.target.value }
    });
    persistNotificationPreferences(next);
    renderFullSettings(activeCompanion());
    return;
  }
  if (event.target.name !== 'provider') return;
  const form = event.target.closest('[data-model-form]');
  const option = runtimeStatus.modelOptions?.[event.target.value];
  if (!form || !option) return;
  form.elements.model.value = option.defaultModel || '';
  form.elements.baseUrl.value = option.baseUrl || '';
  form.elements.apiMode.value = option.apiMode || 'chat_completions';
});
els.firstUse.addEventListener('click', (event) => {
  const localeButton = event.target.closest('[data-locale]');
  if (localeButton) {
    changeInterfaceLocale(localeButton.dataset.locale, 'firstUse');
    return;
  }
  const pathButton = event.target.closest('[data-onboarding-path]');
  if (pathButton) {
    const nextOnboarding = selectOnboardingPath(onboarding, pathButton.dataset.onboardingPath);
    if (!persistNextInterfaceState(nextOnboarding, state)) return;
    render();
    if (nextOnboarding.experience === 'returning') {
      authUiState = reduceAuthState(authUiState, { type: 'MODE', mode: 'login' });
      openFullSettingsSurface('account');
    } else {
      els.firstUse.querySelector('[data-onboarding-stage="language"]')?.focus();
    }
    return;
  }
  if (event.target.closest('[data-action="onboarding-login"]')) {
    authUiState = reduceAuthState(authUiState, { type: 'MODE', mode: 'login' });
    openFullSettingsSurface('account');
    return;
  }
  const preset = event.target.closest('[data-preset-id]');
  if (preset) createCompanionFromPreset(preset.dataset.presetId);
  if (event.target.closest('[data-action="custom-companion"]')) openCompanionDialog('create');
});
els.onboardingBirthdayForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = els.onboardingBirthday.value;
  const normalized = normalizeBirthday(value, localCalendarDate());
  if (!normalized.ok) {
    const key = normalized.error === 'future_date'
      ? 'onboarding.birthday.future'
      : normalized.error === 'age_out_of_range'
        ? 'onboarding.birthday.ageRange'
        : 'onboarding.birthday.invalid';
    els.onboardingBirthday.setAttribute('aria-invalid', 'true');
    els.birthdayError.textContent = tr(key);
    return;
  }
  const nextOnboarding = saveBirthday(onboarding, value, localCalendarDate());
  const nextState = { ...state, user: updateUserProfile(state.user, {
    birthday: nextOnboarding.birthday,
    interfaceLocale: nextOnboarding.interfaceLocale
  }, localCalendarDate()) };
  els.onboardingBirthday.removeAttribute('aria-invalid');
  els.birthdayError.textContent = '';
  if (!persistNextInterfaceState(nextOnboarding, nextState)) {
    els.birthdayError.textContent = tr('error.storageUnavailable');
    return;
  }
  render();
  els.firstUse.querySelector('[data-onboarding-stage="companion"]')?.focus();
});
document.addEventListener('visibilitychange', syncAtmosphere);
els.closeDrawerButton.addEventListener('click', () => closeUtilityDrawer());
els.closeFullSettingsButton.addEventListener('click', () => closeFullSettings());
els.closeCreateButton.addEventListener('click', () => {
  editingCompanionId = null;
  pendingAvatar = null;
  invalidateAvatarRequests();
  resetAvatarFileInputs();
  els.createDialog.close();
});
els.cancelCreateButton.addEventListener('click', () => {
  editingCompanionId = null;
  pendingAvatar = null;
  invalidateAvatarRequests();
  resetAvatarFileInputs();
  els.createDialog.close();
});
els.createDialog.addEventListener('cancel', () => {
  editingCompanionId = null;
  pendingAvatar = null;
  invalidateAvatarRequests();
  resetAvatarFileInputs();
});
els.createDialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(els.createDialog.querySelectorAll('button:not(:disabled):not([hidden]), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'))
    .filter((element) => element.getClientRects().length > 0);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
els.createForm.addEventListener('submit', (event) => {
  event.preventDefault();
  creationFlow = updateCreationDraft(creationFlow, creationDraftFromForm());
  if (!canSubmitCreation(creationFlow)) {
    moveCreationStep(1);
    return;
  }
  saveCompanionFromForm(els.createForm);
});
els.createForm.addEventListener('click', (event) => {
  const creationButton = event.target.closest('[data-creation-action]');
  if (creationButton) {
    const action = creationButton.dataset.creationAction;
    if (action === 'advanced') {
      syncVisibleCreationDraft();
      creationFlow = goToCreationStep(creationFlow, 'identity');
      syncFormFromCreationDraft();
      renderCreationFlow(true);
    } else if (action === 'quick') {
      syncVisibleCreationDraft();
      creationFlow = createCreationFlow({ draft: creationFlow.draft });
      syncFormFromCreationDraft();
      renderCreationFlow(true);
    } else if (action === 'next') moveCreationStep(1);
    else if (action === 'back') moveCreationStep(-1);
    return;
  }
  const button = event.target.closest('[data-action="remove-avatar"]');
  if (!button) return;
  pendingAvatar = null;
  creationFlow = updateCreationDraft(creationFlow, { avatar: null });
  invalidateAvatarRequests();
  resetAvatarFileInputs();
  setAvatarError(tr('avatar.defaultReady'));
  renderAvatarDraft();
});
async function handleAvatarFileChange(event) {
  const [file] = event.target.files;
  if (!file) return;
  const previousAvatar = pendingAvatar;
  avatarRequestState = beginAvatarRequest(avatarRequestState);
  const request = { ...avatarRequestState };
  setAvatarError(tr('avatar.preparing'));
  try {
    const processedAvatar = await processAvatarFile(file);
    if (!acceptsAvatarRequest(request, avatarRequestState) || !els.createDialog.open) return;
    pendingAvatar = processedAvatar;
    creationFlow = updateCreationDraft(creationFlow, { avatar: processedAvatar });
    setAvatarError(tr('avatar.ready'));
    renderAvatarDraft();
  } catch (error) {
    if (!acceptsAvatarRequest(request, avatarRequestState) || !els.createDialog.open) return;
    pendingAvatar = previousAvatar;
    event.target.value = '';
    setAvatarError(localizedAvatarError(error));
    renderAvatarDraft();
  }
}
els.createForm.elements.avatarFile.addEventListener('change', handleAvatarFileChange);
els.createForm.elements.advancedAvatarFile.addEventListener('change', handleAvatarFileChange);
els.createForm.addEventListener('input', () => {
  creationFlow = updateCreationDraft(creationFlow, creationDraftFromForm());
  renderCompanionPreview();
});
els.createForm.addEventListener('change', (event) => {
  if (event.target.name === 'presetId' && creationFlow.mode === 'quick') {
    creationPresetId = event.target.value;
    const preset = WYTH_PRESETS.find((item) => item.id === event.target.value);
    if (preset) {
      creationFlow = updateCreationDraft(creationFlow, {
        relationshipType: preset.relationshipType,
        personality: preset.personality,
        sceneId: preset.sceneId
      });
      syncFormFromCreationDraft();
      renderAvatarDraft();
    }
  } else {
    creationFlow = updateCreationDraft(creationFlow, creationDraftFromForm());
  }
  renderAvatarDraft();
  renderCompanionPreview();
});
els.openProfileButton.addEventListener('click', () => openProfileDialog());
els.closeProfileButton.addEventListener('click', () => els.profileDialog.close());
els.cancelProfileButton.addEventListener('click', () => els.profileDialog.close());
els.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveProfileFromForm(els.profileForm);
});

renderCompanionPreview();
applyInterfaceLocale();
if (activeCompanion()) {
  readReceipts = markCompanionRead(readReceipts, activeCompanion().id);
  saveReadReceipts();
}
render();
const initialAuthCallback = await handleAuthCallback();
await refreshAuthStatus({ renderSettings: true });
if (initialAuthCallback === 'none'
  && state.companions.length === 0
  && onboarding.experience === 'returning'
  && authUiState.state !== 'authenticated') {
  authUiState = reduceAuthState(authUiState, { type: 'MODE', mode: 'login' });
  openFullSettingsSurface('account');
}
refreshRuntimeStatus();
if (activeCompanion()) refreshMemoryStatus(activeCompanion().id);
runLocalScheduler();
setInterval(() => runLocalScheduler(), 60 * 1000);
window.addEventListener('online', () => {
  if (authUiState.errorKey === 'auth.error.unavailable') retryAuthConnection({ focusFeedback: false });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && authUiState.errorKey === 'auth.error.unavailable') retryAuthConnection({ focusFeedback: false });
});
