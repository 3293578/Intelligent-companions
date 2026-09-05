import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function declarationsFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
}

test('desktop chat grid keeps the composer visible while messages scroll internally', () => {
  assert.match(declarationsFor('.app-shell'), /min-height:\s*0\s*;/);
  assert.match(declarationsFor('.chat-panel'), /min-height:\s*0\s*;/);
  assert.match(declarationsFor('.chat-panel'), /overflow:\s*hidden\s*;/);
  assert.match(declarationsFor('.message-list'), /min-height:\s*0\s*;/);
});

test('studio exposes a bounded backend memory clear action', () => {
  assert.match(appJs, /data-action="clear-memory"/);
  assert.match(appJs, /method:\s*'DELETE'/);
});

test('studio exposes latest companion emotion state', () => {
  assert.match(appJs, /function latestEmotionFor/);
  assert.match(appJs, /studio\.careStatus/);
  assert.match(appJs, /studio\.detectedMood/);
});

test('practice style remains available in the studio instead of crowding creation', () => {
  assert.doesNotMatch(html, /name="correctionMode"/);
  assert.doesNotMatch(html, /name="correctionIntensity"/);
  assert.doesNotMatch(html, /name="replyLength"/);
  assert.match(appJs, /studio\.practiceStyle/);
  assert.match(appJs, /practiceStyle:\s*editingCompanionId/);
});

test('chat source cards support saving Daily Picks for later', () => {
  assert.match(appJs, /data-action="\$\{escapeHtml\(item\.action\)\}"/);
  assert.match(appJs, /data-source-id/);
  assert.match(appJs, /function saveDailyPickFromAction/);
  assert.match(appJs, /studio\.savedPicks/);
});

test('Wyth shell places scenes behind chat with a compact rail and utility drawer', () => {
  for (const selector of ['sceneViewport', 'companionList', 'utilityDrawer', 'utilityDock']) {
    assert.match(html, new RegExp(`id="${selector}"`));
  }
  assert.match(html, /data-action="open-drawer"/);
  assert.match(appJs, /function renderScene/);
  assert.match(appJs, /function openUtilityDrawer/);
  assert.match(css, /\.scene-viewport\s*\{/);
  assert.match(css, /\.utility-dock\s*\{/);
});

test('companion creation offers browser-local avatar upload controls', () => {
  assert.match(html, /name="avatarFile"/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(appJs, /processAvatarFile/);
  assert.match(appJs, /data-action="remove-avatar"/);
  assert.match(appJs, /avatar:\s*pendingAvatar/);
});

test('creation dialog separates a focused quick path from seven single-step advanced screens', () => {
  assert.match(html, /id="quickCreation"/);
  assert.match(html, /id="advancedCreation"/);
  assert.match(html, /id="creationStepper"/);
  assert.match(html, /id="creationStepHeading"[^>]*tabindex="-1"/);
  assert.match(html, /id="creationError"[^>]*role="alert"/);
  assert.match(html, /data-creation-action="advanced"/);
  assert.match(html, /data-creation-action="back"/);
  assert.match(html, /data-creation-action="next"/);
  assert.match(html, /data-creation-action="quick"/);
  assert.match(appJs, /createCreationFlow/);
  assert.match(appJs, /goToCreationStep/);
  assert.match(css, /\.create-dialog\.is-advanced/);
  assert.match(css, /\.creation-step\[hidden\]/);
  assert.doesNotMatch(html, /class="creation-identity-shared"/);
  assert.match(html, /data-creation-step="identity"[\s\S]*name="advancedName"[\s\S]*name="advancedAvatarFile"/);
  assert.match(appJs, /creationFlow\.mode === 'advanced'[\s\S]*creationFlow\.step !== 'review'/);
});

test('unavailable creation capabilities are announced and cannot be submitted', () => {
  assert.match(html, /name="voiceId"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(html, /data-i18n="common\.comingSoon"/);
  assert.match(html, /data-visual-style="digital_human"[^>]*aria-disabled="true"/);
  assert.match(html, /data-visual-style="illustration"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /name="pushCategories"/);
  assert.doesNotMatch(html, /name="enabledProviders"/);
  assert.doesNotMatch(html, /name="correctionMode"/);
});

test('editing unavailable visual styles does not leave a misleading default radio checked', () => {
  assert.match(appJs, /for \(const field of els\.createForm\.elements\.visualStyle\) field\.checked = false/);
  assert.match(appJs, /selectVisualStyle\(creationFlow\.draft\.visualStyle, data\.get\('visualStyle'\)\)/);
});

test('avatar file inputs are cleared together after every terminal creation action', () => {
  assert.match(appJs, /function resetAvatarFileInputs\(\)/);
  assert.match(appJs, /for \(const field of \[els\.createForm\.elements\.avatarFile, els\.createForm\.elements\.advancedAvatarFile\]/);
  assert.match(appJs, /openCompanionDialog[\s\S]*resetAvatarFileInputs\(\)/);
  assert.match(appJs, /data-action="remove-avatar"[\s\S]*resetAvatarFileInputs\(\)/);
  assert.match(appJs, /saveCompanionFromForm[\s\S]*resetAvatarFileInputs\(\)/);
});

test('creation synchronizes visible modes, preset defaults, scene avatar, and edit focus', () => {
  assert.match(appJs, /function syncVisibleCreationDraft\(\)/);
  assert.match(appJs, /advanced \? data\.get\('advancedName'\) : data\.get\('name'\)/);
  assert.match(appJs, /presetId\.value = creationPresetId/);
  assert.match(appJs, /addEventListener\('change'[\s\S]*renderAvatarDraft\(\)/);
  assert.match(appJs, /renderAvatarDraft[\s\S]*creationFlow\.draft\.sceneId/);
  assert.match(appJs, /mode === 'edit'[\s\S]*advancedName/);
});

test('advanced avatar errors remain visible and async results require the active request token', () => {
  assert.match(html, /id="advancedAvatarError"[^>]*role="alert"/);
  assert.match(html, /name="advancedAvatarFile"[^>]*aria-describedby="advancedAvatarError"/);
  assert.match(appJs, /avatarRequestState = beginAvatarRequest/);
  assert.match(appJs, /acceptsAvatarRequest/);
  assert.match(appJs, /els\.createDialog\.open/);
});

test('advanced creation preview is limited to quick mode and final review', () => {
  assert.match(appJs, /const showPreview = !advanced \|\| creationFlow\.step === 'review'/);
  assert.match(appJs, /preview\.messages[\s\S]*filter\(\(message\) => \['user', 'assistant'\]\.includes\(message\.role\)\)/);
});

test('final creation sizing overrides legacy dialog width with mode-specific IDs', () => {
  assert.match(css, /#createDialog\s*\{[^}]*width:\s*min\(440px/);
  assert.match(css, /#createDialog\.is-advanced\s*\{[^}]*width:\s*min\(960px/);
});

test('creation review localizes and escapes every persisted field', () => {
  for (const key of ['creation.avatarStatus', 'creation.backgroundStory', 'creation.practiceLanguage', 'creation.scene', 'creation.avatarStyle', 'creation.voice']) {
    assert.match(appJs, new RegExp(key.replace('.', '\\.')));
  }
  assert.match(appJs, /formatRelationship/);
  assert.match(appJs, /formatVisualStyle/);
  assert.match(appJs, /formatSceneLabel/);
  assert.match(appJs, /escapeHtml\(draft\.backgroundStory/);
});

test('utility drawer is keyboard dismissible and exposes a stored reduced-motion control', () => {
  assert.match(html, /id="utilityDrawer"[^>]*inert/);
  assert.match(appJs, /closeDrawerButton\.addEventListener/);
  assert.match(appJs, /event\.key === 'Escape'/);
  assert.match(appJs, /data-action="toggle-reduced-motion"/);
  assert.match(appJs, /wyth-reduce-motion/);
  assert.match(css, /\.reduce-motion\s+\.scene-layer/);
});

test('quick settings contain only frequent controls and link to a five-section full settings surface', () => {
  assert.match(html, /id="fullSettings"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/);
  assert.match(html, /id="fullSettingsNav"/);
  assert.match(html, /id="fullSettingsContent"/);
  assert.match(appJs, /FULL_SETTINGS_SECTIONS/);
  assert.match(appJs, /function renderQuickSettings/);
  assert.match(appJs, /data-setting="proactiveContact"/);
  assert.match(appJs, /data-setting="soundEnabled"/);
  assert.match(appJs, /data-setting="readingMode"/);
  assert.match(appJs, /data-action="open-full-settings"/);
  assert.match(appJs, /function renderFullSettings/);
  assert.match(appJs, /settingsState\.activeSection/);
  assert.match(appJs, /data-settings-section/);
  assert.doesNotMatch(appJs, /function renderQuickSettings[\s\S]*data-model-form[\s\S]*function renderFullSettings/);
});

test('public account settings announce managed DeepSeek and do not expose model switching', () => {
  assert.match(appJs, /announcement\.modelSwitchTitle/);
  assert.match(appJs, /announcement\.modelSwitchBody/);
  assert.doesNotMatch(appJs, /<details class="advanced-local-setup">/);
  assert.doesNotMatch(appJs, /renderAccountSettings[\s\S]*?data-model-form[\s\S]*?function renderCompanionshipSettings/);
  assert.match(appJs, /status\.accountSyncComingSoon/);
});

test('account settings expose distinct loading, signed-out, recovery, and authenticated states', () => {
  assert.match(appJs, /authUiState\.mode === 'password'[\s\S]*?renderAuthForm\(\)[\s\S]*?authUiState\.state === 'authenticated'/);
  assert.match(appJs, /authUiState\.state === 'loading'/);
  assert.match(appJs, /auth\.status\.signedOut/);
  assert.match(appJs, /callback\.kind === 'recovery'[\s\S]*?openFullSettingsSurface\('account'\)/);
  assert.match(appJs, /aria-describedby="auth-password-hint/);
  assert.match(appJs, /aria-invalid="true"/);
});

test('account status failures leave the loading state and distinguish provider outage from local mode', () => {
  assert.match(appJs, /error\.code === 'auth_unavailable'[\s\S]{0,180}configured:\s*true[\s\S]{0,120}state:\s*'signed_out'/);
  assert.match(appJs, /error\.code === 'auth_not_configured'[\s\S]{0,180}configured:\s*false[\s\S]{0,120}state:\s*'signed_out'/);
});

test('account outages can recover without exposing the protected diagnostics endpoint', () => {
  assert.match(appJs, /data-action="auth-retry"/);
  assert.match(appJs, /window\.addEventListener\('online'/);
  assert.match(appJs, /retryAuthConnection\(\{ focusFeedback: false \}\)/);
  assert.match(appJs, /fetch\('\/api\/health\/ready'\)/);
  assert.doesNotMatch(appJs, /fetch\('\/api\/status'\)/);
});

test('account controls keep visible focus and dark-on-gold button contrast', () => {
  assert.match(css, /\.settings-section\s+\.auth-form\s+\.primary-action\s*\{[^}]*color:\s*#17130f[^}]*background:\s*#e7c28e/i);
  assert.match(css, /\.settings-section\s*>\s*header\s+h3:focus-visible/);
  assert.match(css, /\.full-settings-header\s+\.icon-button\s*\{[^}]*color:\s*#17130f/i);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /overscroll-behavior:\s*contain/);
});

test('configured chat failures stay visible and do not create a browser-local assistant reply', () => {
  assert.match(appJs, /chatFailureMessageKey/);
  assert.match(appJs, /chatUiState\s*=\s*completeChatSend\([^,]+,[^,]+,\s*chatFailureMessageKey\(/);
  assert.doesNotMatch(appJs, /catch\s*\{[\s\S]*?createAssistantReply\(companion, userMessage, priorMessages\)[\s\S]*?local_fallback/);
});

test('settings preserve conversation context and implement modal keyboard behavior', () => {
  assert.match(appJs, /captureSettingsView/);
  assert.match(appJs, /restoreSettingsView/);
  assert.match(appJs, /trapFullSettingsFocus/);
  assert.match(appJs, /function trapFullSettingsFocus[\s\S]*profileDialog\.open \|\| els\.createDialog\.open/);
  assert.match(appJs, /settingsState\.surface === 'full'/);
  assert.match(appJs, /closeFullSettings/);
  assert.match(appJs, /setSettingsBackgroundInert\(true\)/);
  assert.match(appJs, /setSettingsBackgroundInert\(false\)/);
  assert.match(appJs, /profileDialog\.open \|\| els\.createDialog\.open/);
  assert.match(css, /\.full-settings-surface/);
  assert.match(css, /\.full-settings-nav/);
  assert.match(css, /@media[^\{]*\(max-width:\s*760px\)[\s\S]*\.full-settings-surface/);
});

test('manual reading preference is persisted and drives the existing reading shell immediately', () => {
  assert.match(appJs, /setReadingMode/);
  assert.match(appJs, /wyth-settings-v1/);
  assert.match(appJs, /data-setting="readingMode"/);
  assert.match(appJs, /settingsState\.quick\.readingMode/);
  assert.match(appJs, /is-history-reading/);
});

test('full settings sections expose every legacy capability through dedicated renderers', () => {
  for (const renderer of ['renderAccountSettings', 'renderCompanionshipSettings', 'renderCharacterSettings', 'renderLanguageSettings', 'renderPrivacySettings']) {
    assert.match(appJs, new RegExp(`function ${renderer}\\(`));
  }
  for (const action of ['edit-profile', 'toggle-notifications', 'toggle-quiet-hours', 'clear-memory', 'edit-companion', 'delete-companion', 'daily-pick', 'run-scheduler', 'stop-category', 'remove-vocab', 'toggle-training']) {
    assert.match(appJs, new RegExp(`data-action="${action}"`));
  }
  assert.match(appJs, /data-notification-setting="quietStart"/);
  assert.match(appJs, /data-notification-setting="quietEnd"/);
  assert.match(appJs, /notificationPermissionStatus/);
});

test('notification preferences use one persistent source and scheduler receives proactive override', () => {
  assert.match(appJs, /wyth-notifications-v1/);
  assert.match(appJs, /loadNotificationPreferences/);
  assert.match(appJs, /saveNotificationPreferences/);
  assert.match(appJs, /proactiveContactOverride:\s*settingsState\.quick\.proactiveContact/);
  assert.match(appJs, /Notification\.requestPermission/);
  assert.match(appJs, /notificationPreferences\.permission === 'granted'/);
  assert.match(appJs, /settings\.notifications\.enable/);
  assert.match(appJs, /settings\.notifications\.browserSettings/);
});

test('background scheduler updates skip every open settings surface', () => {
  const schedulerStart = appJs.indexOf('async function runLocalScheduler');
  const schedulerEnd = appJs.indexOf('function openCompanionDialog', schedulerStart);
  const schedulerSource = appJs.slice(schedulerStart, schedulerEnd);

  assert.notEqual(schedulerStart, -1);
  assert.notEqual(schedulerEnd, -1);
  assert.match(appJs, /function render\(\{ preserveView = false, skipSettings = false \} = \{\}\)/);
  assert.match(appJs, /if \(!skipSettings\) renderStudio\(companion\)/);
  assert.match(schedulerSource, /render\(\{ preserveView: true, skipSettings: Boolean\(activeDrawer\) \|\| settingsState\.surface === 'full' \}\)/);
  assert.doesNotMatch(schedulerSource, /renderFullSettings\(activeCompanion\(\)\)/);
});

test('Wyth visual assets use decodable MIME types and drawer buttons keep readable contrast', () => {
  assert.match(serverJs, /'\.svg':\s*'image\/svg\+xml'/);
  assert.match(serverJs, /'\.webp':\s*'image\/webp'/);
  assert.match(css, /\.utility-drawer\s+\.secondary-action[^{]*\{[^}]*color:\s*#f3ede4/i);
  assert.match(css, /\.utility-drawer\s+\.secondary-action[^{]*\{[^}]*background:\s*rgba\(/i);
});

test('full settings controls and content cards keep readable dark-theme contrast', () => {
  assert.match(css, /\.settings-section\s+\.secondary-action[^{]*\{[^}]*color:\s*#f3ede4[^}]*background:\s*#2[0-9a-f]{5}/i);
  assert.match(css, /\.settings-section\s+\.secondary-action:disabled[^{]*\{[^}]*color:\s*#b[0-9a-f]{5}[^}]*background:\s*rgba\(/i);
  assert.match(css, /\.settings-section\s+\.model-form\s+input,[\s\S]*?\.settings-section\s+\.model-form\s+select\s*\{[^}]*background:\s*#2[0-9a-f]{5}/i);
  assert.match(css, /\.settings-section\s+\.retrieval-item[^{]*\{[^}]*background:\s*rgba\(/i);
  assert.match(css, /\.settings-section\s+\.retrieval-item\s+span[^{]*\{[^}]*color:\s*#c[0-9a-f]{5}/i);
});

test('model settings accept a password key without exposing it in rendered status', () => {
  assert.match(appJs, /name="apiKey"\s+type="password"/);
  assert.match(appJs, /autocomplete="off"/);
  assert.match(appJs, /apiKey:\s*data\.get\('apiKey'\)/);
  assert.doesNotMatch(appJs, /value="\$\{[^}]*apiKey/);
});

test('server defaults to DeepSeek even when another provider key exists in the environment', () => {
  assert.match(serverJs, /provider:\s*process\.env\.LLM_PROVIDER\s*\|\|\s*'deepseek'/);
  assert.doesNotMatch(serverJs, /OPENAI_API_KEY\s*&&\s*!process\.env\.DEEPSEEK_API_KEY/);
});

test('creation and profile dialogs keep every native control readable in the dark surface', () => {
  assert.match(css, /\.create-dialog\s+select\s*\{[^}]*color-scheme:\s*dark/i);
  assert.match(css, /\.create-dialog\s+select\s+option\s*\{[^}]*color:\s*#f[0-9a-f]{5}[^}]*background:\s*#2[0-9a-f]{5}/i);
  assert.match(css, /\.create-dialog\s+\.secondary-action[^{]*\{[^}]*color:\s*#f[0-9a-f]{5}[^}]*background:\s*#2[0-9a-f]{5}/i);
  assert.match(css, /\.create-dialog\s+\.primary-action[^{]*\{[^}]*color:\s*#1[0-9a-f]{5}[^}]*background:\s*#e7c28e/i);
  assert.match(css, /\.create-dialog\s+:disabled[^{]*\{[^}]*opacity:\s*1/i);
  assert.match(css, /\.create-dialog\s+input::file-selector-button[^{]*\{[^}]*color:\s*#1[0-9a-f]{5}[^}]*background:\s*#e7c28e/i);
});

test('translation and vocabulary surfaces avoid light text on light controls', () => {
  assert.match(css, /\.translate-popover\s+\.save-vocab[^{]*\{[^}]*background:\s*#e7c28e[^}]*color:\s*#1[0-9a-f]{5}/i);
  assert.match(css, /\.utility-drawer\s+\.vocab-remove[^{]*\{[^}]*color:\s*#ffb[0-9a-f]{3}/i);
});

test('companion switching uses staged camera motion and long conversations gain reading protection', () => {
  assert.match(appJs, /beginCompanionTransition/);
  assert.match(appJs, /dataset\.transitionDirection/);
  assert.match(appJs, /historyReading/);
  assert.match(css, /\.app-shell\.is-transitioning\s+\.scene-layer-current/);
  assert.match(css, /\.app-shell\.is-history-reading\s+\.message-list/);
  assert.match(css, /\.scene-continuity/);
});

test('avatar editing shows a local preview and preserves the previous avatar on invalid replacement', () => {
  assert.match(html, /id="avatarPreview"/);
  assert.match(appJs, /function renderAvatarDraft/);
  assert.match(appJs, /const previousAvatar = pendingAvatar/);
  assert.match(appJs, /pendingAvatar = previousAvatar/);
});

test('selected text opens explicit translate, natural phrasing, and read-aloud actions', () => {
  assert.match(html, /data-language-action="translate"/);
  assert.match(html, /data-language-action="natural"/);
  assert.match(html, /data-language-action="speak"/);
  assert.match(appJs, /speechSynthesis/);
  assert.match(appJs, /\/api\/language-assist/);
});

test('chat messages expose a local device-time label without a server-time dependency', () => {
  assert.match(appJs, /formatChatTimestamp/);
  assert.match(appJs, /message-time/);
  assert.match(css, /\.message-time/);
});

test('selection actions dismiss completely before an outside pointer interaction can retain old text', () => {
  assert.match(appJs, /function dismissSelectionActions/);
  assert.match(appJs, /window\.getSelection\(\)\?\.removeAllRanges\(\)/);
  assert.match(appJs, /document\.addEventListener\('pointerdown'/);
  assert.match(appJs, /ignoreSelectionUntilPointerUp/);
  assert.match(css, /\.language-action-menu\[hidden\][^{]*\{[^}]*display:\s*none\s*!important/i);
  assert.match(css, /\.translate-popover\[hidden\][^{]*\{[^}]*display:\s*none\s*!important/i);
});

test('selection supports paragraph translation and the pending reply is a visible particle cluster', () => {
  assert.match(appJs, /text\.length\s*>\s*2000/);
  assert.match(appJs, /document\.addEventListener\('pointerdown'/);
  assert.match(appJs, /document\.addEventListener\('selectionchange'/);
  assert.match(appJs, /if\s*\(!els\.translatePopover\.hidden\)\s*return/);
  assert.match(appJs, /closest\('\[data-language-action\]'\)/);
  assert.match(appJs, /pending-orb-cluster/);
  assert.match(css, /\.pending-orb-cluster/);
  assert.match(css, /\.message\.assistant_pending\s*\{[^}]*background:\s*transparent/i);
});

test('chat exposes manual support and a dismissible non-diagnostic presence layer', () => {
  assert.match(html, /data-action="stay-with-me"/);
  assert.match(html, /id="companionPresence"/);
  assert.match(html, /data-action="dismiss-support"/);
  assert.match(appJs, /requestManualSupport/);
  assert.match(appJs, /setSupportPresence/);
  assert.match(css, /\.support-presence/);
});

test('support mode suppresses contextual learning actions and respects reduced motion', () => {
  assert.match(appJs, /suppressLearning/);
  assert.match(appJs, /resolveSupportPresence/);
  assert.match(appJs, /translateTrigger\.hidden/);
  assert.match(css, /\.reduce-motion\s+\.support-presence/);
});

test('chat labels and persisted links are escaped and restricted to safe HTTP URLs', () => {
  assert.match(appJs, /escapeHtml\(label\)/);
  assert.match(appJs, /safeHttpUrl/);
  assert.match(appJs, /const safeUrl = safeHttpUrl\(metadata\.url\)/);
});

test('first use offers the approved prompt and five companionship presets', () => {
  assert.match(html, /id="firstUse"/);
  assert.match(html, /data-i18n="onboarding\.prompt"/);
  assert.match(appJs, /WYTH_PRESETS/);
  assert.match(appJs, /data-preset-id/);
});

test('first use distinguishes returning users and keeps an accessible sign-in shortcut', () => {
  assert.match(html, /data-onboarding-stage="welcome"/);
  assert.match(html, /data-onboarding-path="new"/);
  assert.match(html, /data-onboarding-path="returning"/);
  assert.match(html, /id="onboardingLoginButton"[^>]*type="button"/);
  assert.match(appJs, /onboardingLoginButton:\s*document\.querySelector\('#onboardingLoginButton'\)/);
  assert.match(appJs, /firstUse\.setAttribute\('aria-labelledby',\s*activeHeading\.id\)/);
  assert.match(appJs, /selectOnboardingPath/);
  assert.match(appJs, /stage:\s*hasExistingCompanions\s*\?\s*'complete'\s*:\s*'welcome'/);
  assert.match(css, /\.onboarding-login\s*\{/);
  assert.match(css, /\.onboarding-login:focus-visible/);
});

test('account access is persistent and onboarding groups sign-in with language controls', () => {
  assert.match(html, /id="accountEntryButton"[^>]*type="button"/);
  assert.match(html, /id="globalLanguageSwitch"[^>]*role="group"/);
  assert.match(html, /data-global-locale="zh-CN"/);
  assert.match(html, /data-global-locale="en"/);
  assert.match(html, /class="onboarding-account-nav"/);
  assert.match(html, /class="onboarding-account-divider"/);
  assert.match(appJs, /accountEntryButton:\s*document\.querySelector\('#accountEntryButton'\)/);
  assert.match(appJs, /globalLanguageSwitch:\s*document\.querySelector\('#globalLanguageSwitch'\)/);
  assert.match(appJs, /accountEntryButton\.addEventListener\('click',\s*openAccountSurface\)/);
  assert.match(appJs, /globalLanguageSwitch\.addEventListener\('click'/);
  assert.match(css, /\.account-entry\s*\{/);
  assert.match(css, /\.global-language-switch\s*\{/);
  assert.match(css, /\.global-language-switch button\[aria-pressed="true"\]/);
  assert.match(css, /\.onboarding-account-nav\s*\{/);
});

test('legal and support links live in a framed top-right menu on desktop and mobile', () => {
  assert.match(html, /<details class="site-legal-menu">/);
  assert.match(html, /class="site-legal-links"/);
  assert.match(css, /\.site-legal-menu\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:/);
  assert.match(css, /\.site-legal-links\s+a\s*\{[\s\S]*?border:/);
  assert.doesNotMatch(css, /\.site-legal-links\s*\{\s*display:\s*none/);
});

test('signup has an explicit email verification state and confirmation resend action', () => {
  assert.match(appJs, /mode === 'verify'/);
  assert.match(appJs, /data-action="auth-resend"/);
  assert.match(appJs, /authRequest\('\/api\/auth\/resend'/);
  assert.match(appJs, /mode:\s*'verify'/);
  assert.match(appJs, /error === 'invalid_password'\) return 'password'/);
  assert.doesNotMatch(appJs, /error === 'invalid_password' \|\| error === 'invalid_credentials'/);
  assert.match(css, /\.auth-verification-actions\s*\{/);
});

test('authenticated first use skips the returning gate and removes the redundant login shortcut', () => {
  assert.match(appJs, /resolveOnboardingStage\(\{[\s\S]*?authState:\s*authUiState\.state/);
  assert.match(appJs, /onboardingLoginButton\.hidden\s*=\s*authUiState\.state\s*===\s*'authenticated'/);
  assert.match(appJs, /previousAuthState\s*!==\s*authUiState\.state\)\s*renderFirstUse\(\)/);
});

test('the active scene has a lightweight ambient canvas that pauses in quiet states', () => {
  assert.match(html, /id="sceneAtmosphere"/);
  assert.match(appJs, /requestAnimationFrame/);
  assert.match(appJs, /shouldAnimateScene/);
  assert.match(appJs, /document\.hidden/);
  assert.match(css, /\.scene-atmosphere/);
});

test('scene presentation resolves local time and five distinct ambient kinds', () => {
  assert.match(appJs, /resolveSceneTime/);
  assert.match(appJs, /resolveAmbientDescriptor/);
  assert.match(appJs, /descriptor\.kind === 'rain'/);
  assert.match(appJs, /descriptor\.kind === 'passing_light'/);
  assert.match(appJs, /descriptor\.kind === 'city_glow'/);
  assert.match(css, /data-scene-time="morning"/);
  assert.match(css, /data-scene-time="night"/);
});

test('mobile transcript never exposes a horizontal scrollbar for long content', () => {
  assert.match(css, /\.message-list\s*\{[^}]*overflow-x:\s*hidden/is);
  assert.match(css, /\.message\s*\{[^}]*min-width:\s*0/is);
  assert.match(css, /\.message\s+p\s*\{[^}]*overflow-wrap:\s*anywhere/is);
});

test('first use exposes language and birthday before companion selection', () => {
  assert.match(html, /id="interfaceLanguageSwitch"/);
  assert.match(html, /id="onboardingLanguageOptions"[^>]*role="group"[^>]*aria-labelledby="firstUseLanguageTitle"/);
  assert.match(html, /class="onboarding-language-choice"[^>]*data-locale="zh-CN"/);
  assert.match(html, /class="onboarding-language-choice"[^>]*data-locale="en"/);
  assert.match(html, /id="onboardingBirthday"/);
  assert.match(html, /data-onboarding-stage="language"/);
  assert.match(html, /data-onboarding-stage="birthday"/);
  assert.match(html, /data-onboarding-stage="companion"/);
  assert.match(html, /autocomplete="bday"/);
  assert.match(appJs, /setInterfaceLocale/);
  assert.match(appJs, /saveBirthday/);
  assert.match(appJs, /els\.firstUse\.querySelectorAll\('\[data-locale\]'\)/);
  assert.match(css, /\.onboarding-language-options\s*\{/);
  assert.match(css, /\.onboarding-language-choice\[aria-pressed="true"\]/);
});

test('language switching updates document metadata without reloading', () => {
  assert.match(appJs, /document\.documentElement\.lang/);
  assert.match(appJs, /data-i18n-placeholder/);
  assert.match(appJs, /aria-pressed/);
  assert.match(appJs, /globalLanguageSwitch\.hidden\s*=\s*Boolean\(firstUseVisible\)/);
  assert.match(appJs, /dataset\.globalLocale/);
  assert.doesNotMatch(appJs, /location\.reload\(\)/);
});

test('onboarding keeps a cinematic full-screen surface with accessible validation and quiet motion', () => {
  assert.match(css, /\.onboarding-language\s*\{/);
  assert.match(css, /\.onboarding-step\s*\{/);
  assert.match(css, /\.onboarding-error\s*\{/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^{]*\{[\s\S]*?\.onboarding-step/);
});

test('creation keeps translated options on stable canonical values and guards minors twice', () => {
  for (const value of ['Girlfriend', 'Boyfriend', 'Bestie', 'Mentor', 'Tree hole', 'Knowledge brother']) {
    assert.match(html, new RegExp(`<option value="${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
  for (const value of ['cinematic_semireal', 'digital_human', 'illustration']) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
  assert.match(appJs, /function normalizeRelationshipForAge/);
  assert.match(appJs, /ageGroup === 'minor'/);
  assert.match(appJs, /relationshipType:\s*normalizeRelationshipForAge/);
  assert.match(appJs, /syncMinorCreationRestrictions/);
});

test('locale startup reconciliation and profile birthday update both persisted stores', () => {
  assert.match(appJs, /function reconcileInterfaceLocale/);
  assert.match(appJs, /saveOnboardingState\(\)/);
  assert.match(appJs, /saveState\(\)/);
  assert.match(html, /id="profileBirthday"/);
  assert.match(html, /id="profileBirthdayError"/);
  assert.match(appJs, /saveBirthday\(onboarding/);
  assert.match(appJs, /drawerTitle\.textContent\s*=\s*tr/);
  assert.match(html, /name="showPrivacyNotice"[\s\S]*data-i18n=/);
});

test('model save errors use a stable localized key instead of backend error text', () => {
  assert.match(appJs, /modelSettingsState\.errorKey/);
  assert.match(appJs, /tr\(modelSettingsState\.errorKey\)/);
  assert.doesNotMatch(appJs, /modelSettingsState\s*=\s*\{[^}]*error:\s*error\.message/s);
});

test('first-use storage failures are announced and locale focus is restored', () => {
  assert.match(html, /id="onboardingStorageError"[^>]*role="alert"[^>]*aria-live="polite"/);
  assert.match(appJs, /onboardingStorageError\.textContent/);
  assert.match(appJs, /requestAnimationFrame[\s\S]*data-locale/);
  assert.match(appJs, /changeInterfaceLocale\([^,]+,\s*'drawer'\)/);
  assert.match(appJs, /changeInterfaceLocale\([^,]+,\s*'firstUse'\)/);
  assert.match(appJs, /source === 'drawer'[\s\S]*els\.studioPanel\.querySelector/);
  assert.doesNotMatch(appJs, /requestAnimationFrame\(\(\) => document\.querySelector\(`\[data-locale/);
});

test('startup keeps local UI interactive while authentication refreshes in the background', () => {
  assert.match(appJs, /render\(\);\s*refreshRuntimeStatus\(\);\s*void \(async \(\) => \{/);
  assert.match(appJs, /const initialAuthCallback = await handleAuthCallback\(\);\s*await refreshAuthStatus\(\{ renderSettings: true \}\);/);
  assert.match(appJs, /readRememberedLocalOwner\(localStorage\)/);
  assert.match(appJs, /rememberLocalOwner\(localStorage, nextOwner\)/);
  assert.match(appJs, /clearRememberedLocalOwner\(localStorage\)/);
});

test('account status checks use a short timeout while interactive auth keeps its cold-start allowance', () => {
  assert.match(appJs, /const AUTH_REQUEST_TIMEOUT_MS\s*=\s*65_000/);
  assert.match(appJs, /const AUTH_STATUS_TIMEOUT_MS\s*=\s*9_000/);
  assert.match(appJs, /async function authRequest\(path, body, \{ timeoutMs = AUTH_REQUEST_TIMEOUT_MS \} = \{\}\)/);
  assert.match(appJs, /async function refreshAuthStatus\(\{ renderSettings = true, timeoutMs = AUTH_STATUS_TIMEOUT_MS \} = \{\}\)/);
  assert.match(appJs, /authRequest\('\/api\/auth\/status', undefined, \{ timeoutMs \}\)/);
  assert.match(appJs, /scheduleColdStartAuthRecovery[\s\S]*timeoutMs: AUTH_REQUEST_TIMEOUT_MS/);
  assert.match(appJs, /withAuthDeadline\([\s\S]*onTimeout:\s*\(\)\s*=>\s*controller\.abort\(\)/);
});
