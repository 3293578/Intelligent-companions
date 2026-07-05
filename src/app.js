import {
  buildContentRetrievalPlan,
  CATEGORY_LIBRARY,
  createAssistantReply,
  createCompanion,
  createDailyPush,
  createSeedState,
  createUserMessage,
  deserializeState,
  generateCompanionPreview,
  previewNotification,
  runScheduledDailyPushes,
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
  completeChatSend,
  countUnreadCompanionMessages,
  createDailyPushActions,
  markCompanionRead,
  tagAssistantReplySource
} from './chatUiState.js';
import { retrieveContentForCompanion } from './contentAdapters.js';

const STORAGE_KEY = 'english-companions-state-v1';

const els = {
  companionList: document.querySelector('#companionList'),
  chatHeader: document.querySelector('#chatHeader'),
  messageList: document.querySelector('#messageList'),
  messageForm: document.querySelector('#messageForm'),
  messageInput: document.querySelector('#messageInput'),
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
  openProfileButton: document.querySelector('#openProfileButton'),
  profileDialog: document.querySelector('#profileDialog'),
  profileForm: document.querySelector('#profileForm'),
  closeProfileButton: document.querySelector('#closeProfileButton'),
  cancelProfileButton: document.querySelector('#cancelProfileButton')
};

let state = loadState();
let editingCompanionId = null;
let notificationPreferences = {
  enabled: true,
  quietHours: {
    enabled: true,
    start: '22:30',
    end: '07:00'
  }
};
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
  error: '',
  savedAt: null
};
let backendMemoryStatus = {};
let chatUiState = {
  pendingCompanionId: null,
  error: ''
};
let readReceipts = loadReadReceipts();
let savedPicks = loadSavedPicks();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const loaded = raw ? deserializeState(raw) : createSeedState();
  if (!loaded.user) return { ...loaded, user: createSeedState().user };
  return loaded;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, serializeState(state));
}

function loadReadReceipts() {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-read-receipts`) || '{}');
  } catch {
    return {};
  }
}

function saveReadReceipts() {
  localStorage.setItem(`${STORAGE_KEY}-read-receipts`, JSON.stringify(readReceipts));
}

function loadSavedPicks() {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-saved-picks`) || '{}');
  } catch {
    return {};
  }
}

function saveSavedPicks() {
  localStorage.setItem(`${STORAGE_KEY}-saved-picks`, JSON.stringify(savedPicks));
}

function activeCompanion() {
  return state.companions.find((companion) => companion.id === state.selectedCompanionId) || state.companions[0];
}

function companionMessages(companionId) {
  return state.messages.filter((message) => message.companionId === companionId);
}

function formatCategory(category) {
  return CATEGORY_LIBRARY[category]?.label || category.replaceAll('_', ' ');
}

function formatCareValue(value) {
  return String(value || '')
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatProvider(provider) {
  const labels = {
    youtube: 'YouTube',
    news: 'News',
    reddit: 'Reddit',
    web_search: 'Web search'
  };
  return labels[provider] || formatCareValue(provider);
}

function formatCorrectionMode(mode) {
  const labels = {
    after_reply: 'After reply',
    gentle_inline: 'Gentle inline',
    off: 'Off'
  };
  return labels[mode] || formatCareValue(mode);
}

function formatModelProvider(provider) {
  const option = runtimeStatus.modelOptions?.[provider];
  return option?.label || formatCareValue(provider);
}

function lastMessage(companionId) {
  const messages = companionMessages(companionId);
  return messages[messages.length - 1]?.content || 'No messages yet.';
}

function latestEmotionFor(companionId) {
  return [...companionMessages(companionId)]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata?.emotion)
    ?.metadata.emotion || null;
}

function render() {
  const companion = activeCompanion();
  if (!companion) return;
  renderCompanionList();
  renderProfileCard();
  renderChatHeader(companion);
  renderMessages(companion);
  renderComposer(companion);
  renderStudio(companion);
}

function renderProfileCard() {
  els.openProfileButton.innerHTML = `
    <span>
      <strong>${escapeHtml(state.user.displayName)}</strong>
      <small>${escapeHtml(state.user.email)}</small>
    </span>
    <span class="privacy-pill">${state.user.privacy.allowAiTraining ? 'Training on' : 'Opted out'}</span>
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
      <button class="companion-card${active}" type="button" data-companion-id="${companion.id}">
        <span class="avatar" style="background:${companion.avatarColor}">${companion.name.slice(0, 1).toUpperCase()}</span>
        <span>
          <span class="card-title-row">
            <span class="companion-name">${escapeHtml(companion.name)}</span>
            <span class="card-badges">
              ${unreadCount > 0 ? `<span class="unread-dot">${unreadCount}</span>` : ''}
              ${hasPush ? '<span class="daily-dot">DP</span>' : ''}
            </span>
          </span>
          <span class="companion-meta">${escapeHtml(companion.relationshipType)} / ${escapeHtml(companion.personality)}</span>
          <span class="last-message">${escapeHtml(lastMessage(companion.id))}</span>
        </span>
      </button>
    `;
  }).join('');
}

function renderChatHeader(companion) {
  const llmLabel = runtimeStatus.llm?.configured
    ? `${runtimeStatus.llm.model} / ${formatChatSource(runtimeStatus.llm.lastChatSource)}`
    : 'Local fallback';
  els.chatHeader.innerHTML = `
    <div class="chat-identity">
      <span class="avatar" style="background:${companion.avatarColor}">${companion.name.slice(0, 1).toUpperCase()}</span>
      <div>
        <div class="chat-title-row">
          <h2>${escapeHtml(companion.name)}</h2>
        </div>
        <p class="companion-meta">${escapeHtml(companion.relationshipType)} / ${escapeHtml(companion.personality)}</p>
      </div>
    </div>
    <span class="status-pill" title="${escapeHtml(runtimeStatus.llm?.baseUrl || 'Local fallback')}">${escapeHtml(llmLabel)}</span>
  `;
}

function renderMessages(companion) {
  const messages = buildRenderableMessages(state.messages, {
    companionId: companion.id,
    pendingCompanionId: chatUiState.pendingCompanionId
  });
  if (messages.length === 0) {
    els.messageList.innerHTML = '<div class="empty-state">Start by sharing one small thing from your day in English.</div>';
    return;
  }

  els.messageList.innerHTML = messages.map((message) => {
    const label = message.role === 'system_push' ? 'Daily Pick' : message.role === 'user' ? 'You' : companion.name;
    const linked = linkify(escapeHtml(message.content));
    const sourceCard = message.role === 'system_push' && message.metadata
      ? renderSourceCard(message.metadata, companion)
      : '';
    const chatSource = message.role === 'assistant' && message.metadata?.chatSource
      ? renderChatSource(message.metadata.chatSource)
      : '';
    return `
      <article class="message ${message.role}">
        <div class="message-label">${label}</div>
        <p>${linked}</p>
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
    ? `${pendingCompanion?.name || companion.name} is replying...`
    : 'Share your day in English...';
  const button = els.messageForm.querySelector('button[type="submit"]');
  button.disabled = isPending;
  button.textContent = isPending ? 'Sending' : 'Send';
}

function renderSourceCard(metadata, companion) {
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
      <strong>${escapeHtml(metadata.title || 'Curated source')}</strong>
      <span>${escapeHtml(metadata.summary || 'A curated item selected from this companion preference.')}</span>
      ${metadata.url ? `<a href="${escapeHtml(metadata.url)}" target="_blank" rel="noreferrer">Open source</a>` : ''}
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
              data-url="${escapeHtml(metadata.url || '')}"
              data-summary="${escapeHtml(metadata.summary || '')}"
              data-source-type="${escapeHtml(metadata.sourceType || metadata.sourceLabel || '')}"
              ${item.disabled ? 'disabled' : ''}
            >${escapeHtml(item.label)}</button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderChatSource(source) {
  const label = source === 'llm' ? 'LLM reply' : 'Local fallback';
  return `<div class="chat-source ${source === 'llm' ? 'llm' : 'fallback'}">${label}</div>`;
}

function renderStudio(companion) {
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

  els.studioPanel.innerHTML = `
    <div class="studio-card">
      <h2>${escapeHtml(companion.name)}'s studio</h2>
      <p class="studio-muted">Tune the emotional role and the daily content habit.</p>
      <div class="quick-actions">
        <button class="primary-action" type="button" data-action="daily-pick">Generate Daily Pick</button>
        <button class="secondary-action" type="button" data-action="run-scheduler">Run schedule now</button>
        <button class="secondary-action" type="button" data-action="edit-companion">Edit setup</button>
      </div>
    </div>

    ${renderModelSettings()}

    <div class="studio-card">
      <h3>Companion setup</h3>
      <div class="studio-row"><span>Relationship</span><strong>${escapeHtml(companion.relationshipType)}</strong></div>
      <div class="studio-row"><span>Tone</span><strong>${escapeHtml(companion.personality)}</strong></div>
      <div class="studio-row"><span>Avatar</span><strong>${escapeHtml(companion.avatarStyle)}</strong></div>
      <div class="studio-row"><span>Closeness</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.intimacyLevel || 'gentle'))}</strong></div>
      <div class="studio-row"><span>Support</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.supportMode || 'listen_first'))}</strong></div>
      <div class="studio-row"><span>Care habit</span><strong>${escapeHtml(formatCareValue(companion.careStyle?.proactiveCareFrequency || 'sometimes'))}</strong></div>
      <div class="studio-row"><span>Memory</span><strong>${companion.memoryEnabled ? 'On' : 'Off'}</strong></div>
    </div>

    <div class="studio-card">
      <h3>Practice style</h3>
      <div class="studio-row"><span>Correction</span><strong>${escapeHtml(formatCorrectionMode(companion.practiceStyle?.correctionMode || 'after_reply'))}</strong></div>
      <div class="studio-row"><span>Level</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.correctionIntensity || 'light'))}</strong></div>
      <div class="studio-row"><span>Reply length</span><strong>${escapeHtml(formatCareValue(companion.practiceStyle?.replyLength || 'medium'))}</strong></div>
      <div class="studio-row"><span>Natural phrases</span><strong>${companion.practiceStyle?.naturalPhrases === false ? 'Off' : 'On'}</strong></div>
    </div>

    <div class="studio-card">
      <h3>Care status</h3>
      <div class="studio-row"><span>Detected mood</span><strong>${escapeHtml(formatCareValue(latestEmotion?.label || 'neutral'))}</strong></div>
      <div class="studio-row"><span>Valence</span><strong>${escapeHtml(formatCareValue(latestEmotion?.valence || 'neutral'))}</strong></div>
      <p class="studio-muted">${escapeHtml(latestEmotion?.supportHint || 'No mood signal yet. The companion will update this after chatting with you.')}</p>
    </div>

    <div class="studio-card">
      <h3>Daily push</h3>
      <div class="studio-row"><span>Time</span><strong>${escapeHtml(companion.pushSchedule.time)}</strong></div>
      <div class="studio-row"><span>Max daily</span><strong>${companion.pushSchedule.maxDaily}</strong></div>
      <div class="tag-list">
        ${companion.pushCategories.map((category) => `
          <button class="tag tag-button" type="button" data-action="stop-category" data-category="${escapeHtml(category)}">
            ${escapeHtml(formatCategory(category))} x
          </button>
        `).join('')}
      </div>
      ${companion.customKeywords?.length > 0 ? `
        <div class="custom-keywords">
          <div class="section-label small-label">Custom keywords</div>
          <div class="tag-list">
            ${companion.customKeywords.map((keyword) => `<span class="tag keyword-tag">${escapeHtml(keyword)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <p class="studio-muted hint">Click a category to stop this type of content. At least one category stays active.</p>
    </div>

    <div class="studio-card">
      <h3>Saved picks</h3>
      ${companionSavedPicks.length > 0 ? `
        <div class="retrieval-stack">
          ${companionSavedPicks.slice(0, 3).map((item) => `
            <div class="retrieval-item">
              <strong>${escapeHtml(item.title || 'Saved Daily Pick')}</strong>
              <span>${escapeHtml(item.summary || item.sourceType || 'Saved for later')}</span>
              ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open source</a>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '<p class="studio-muted">Save a Daily Pick from the chat to keep it here for later.</p>'}
    </div>

    <div class="studio-card">
      <h3>Retrieval plan</h3>
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
        `).join('') : '<p class="studio-muted">Enable at least one provider that matches the selected categories.</p>'}
      </div>
    </div>

    <div class="studio-card">
      <h3>Notification preview</h3>
      <div class="studio-row"><span>Notifications</span><strong>${notificationPreferences.enabled ? 'On' : 'Off'}</strong></div>
      <div class="studio-row"><span>Quiet hours</span><strong>${notificationPreferences.quietHours.start} - ${notificationPreferences.quietHours.end}</strong></div>
      <p class="studio-muted">${
        notificationPreview
          ? notificationPreview.muted
            ? escapeHtml(notificationPreview.reason)
            : `${escapeHtml(notificationPreview.title)}: ${escapeHtml(notificationPreview.body)}`
          : 'Generate a Daily Pick to preview the notification text.'
      }</p>
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="toggle-notifications">${notificationPreferences.enabled ? 'Turn off' : 'Turn on'}</button>
        <button class="secondary-action" type="button" data-action="toggle-quiet-hours">${notificationPreferences.quietHours.enabled ? 'Disable quiet hours' : 'Enable quiet hours'}</button>
      </div>
    </div>

    <div class="studio-card">
      <h3>Local scheduler</h3>
      <p class="studio-muted">This browser checks schedules locally and inserts Daily Picks when a companion's push time has arrived.</p>
      <div class="studio-row"><span>Last check</span><strong>${schedulerStatus.lastRunAt ? escapeHtml(formatTime(schedulerStatus.lastRunAt)) : 'Not yet'}</strong></div>
      <div class="studio-row"><span>Last alerts</span><strong>${schedulerStatus.lastNotifications.length}</strong></div>
      <div class="studio-row"><span>Source mode</span><strong>${schedulerStatus.lastSourceMode === 'external' ? 'External first' : 'Mock fallback'}</strong></div>
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
      <h3>Long-term memory</h3>
      <div class="studio-row"><span>Storage</span><strong>Backend local</strong></div>
      <div class="studio-row"><span>Saved items</span><strong>${memoryStatus?.entryCount || 0}</strong></div>
      <div class="studio-row"><span>Size</span><strong>${memoryBytes}</strong></div>
      <p class="studio-muted">${escapeHtml(memorySummary || 'No long-term memory saved yet. Share something personal and this companion will keep a small bounded memory profile.')}</p>
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="clear-memory" ${(memoryStatus?.entryCount || 0) === 0 ? 'disabled' : ''}>Clear memory</button>
      </div>
    </div>

    <div class="studio-card">
      <h3>Privacy & data</h3>
      <div class="studio-row"><span>Profile</span><strong>${escapeHtml(state.user.displayName)}</strong></div>
      <div class="studio-row"><span>Storage</span><strong>${state.user.privacy.localOnly ? 'Local browser' : 'Cloud-ready'}</strong></div>
      <div class="studio-row"><span>AI training</span><strong>${state.user.privacy.allowAiTraining ? 'Allowed' : 'Opted out'}</strong></div>
      ${state.user.privacy.showPrivacyNotice ? '<p class="studio-muted">This MVP keeps chat history in localStorage. Future API integrations should preserve the opt-out setting.</p>' : ''}
      <div class="quick-actions">
        <button class="secondary-action" type="button" data-action="edit-profile">Edit profile</button>
        <button class="secondary-action" type="button" data-action="toggle-training">${state.user.privacy.allowAiTraining ? 'Opt out' : 'Allow training'}</button>
      </div>
    </div>

    <button class="danger-action" type="button" data-action="delete-companion">Delete companion</button>
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
  const statusText = modelSettingsState.error
    ? modelSettingsState.error
    : modelSettingsState.savedAt
      ? `Saved ${formatTime(modelSettingsState.savedAt)}`
      : llm.configured
        ? 'Ready'
        : `Missing ${llm.keyEnv || selectedOption.keyEnv || 'API key'}`;

  return `
    <div class="studio-card">
      <h3>Model</h3>
      <form class="model-form" data-model-form>
        <label>
          Provider
          <select name="provider">
            ${providerOptions.map(([key, option]) => `
              <option value="${escapeHtml(key)}" ${key === provider ? 'selected' : ''}>${escapeHtml(option.label)}</option>
            `).join('')}
          </select>
        </label>
        <label>
          Model
          <input name="model" type="text" value="${escapeHtml(llm.model || selectedOption.defaultModel || '')}" placeholder="${escapeHtml(selectedOption.defaultModel || 'model name')}">
        </label>
        <label>
          Base URL
          <input name="baseUrl" type="url" value="${escapeHtml(llm.baseUrl || selectedOption.baseUrl || '')}" placeholder="${escapeHtml(selectedOption.baseUrl || 'https://api.example.com')}">
        </label>
        <label>
          API mode
          <select name="apiMode">
            <option value="chat_completions" ${llm.apiMode === 'chat_completions' ? 'selected' : ''}>Chat completions</option>
            <option value="responses" ${llm.apiMode === 'responses' ? 'selected' : ''}>Responses</option>
          </select>
        </label>
        <div class="studio-row"><span>Key</span><strong>${llm.configured ? 'Available' : escapeHtml(llm.keyEnv || selectedOption.keyEnv || 'Not set')}</strong></div>
        <div class="studio-row"><span>Status</span><strong>${escapeHtml(statusText)}</strong></div>
        <div class="studio-row"><span>Companions</span><strong>Unchanged</strong></div>
        <button class="secondary-action" type="submit" ${modelSettingsState.saving ? 'disabled' : ''}>${modelSettingsState.saving ? 'Saving' : 'Save model'}</button>
      </form>
    </div>
  `;
}

function renderCategoryFields(selectedCategories = ['funny_videos', 'world_news', 'psychology']) {
  const defaults = new Set(selectedCategories);
  els.categoryFields.innerHTML = Object.entries(CATEGORY_LIBRARY).map(([key, item]) => `
    <label>
      <input type="checkbox" name="pushCategories" value="${key}" ${defaults.has(key) ? 'checked' : ''}>
      ${escapeHtml(item.label)}
    </label>
  `).join('');
}

function setProviderFields(selectedProviders = ['youtube', 'news', 'reddit', 'web_search']) {
  const selected = new Set(selectedProviders);
  Array.from(els.createForm.elements.enabledProviders || []).forEach((field) => {
    field.checked = selected.has(field.value);
  });
}

function selectCompanion(id) {
  state.selectedCompanionId = id;
  readReceipts = markCompanionRead(readReceipts, id);
  saveState();
  saveReadReceipts();
  render();
  refreshMemoryStatus(id);
}

async function requestAssistantReply(companion, userMessage, priorMessages) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        companion,
        userMessage,
        priorMessages
      })
    });
    if (!response.ok) throw new Error('Chat proxy unavailable');
    const payload = await response.json();
    if (payload?.source) {
      runtimeStatus = {
        ...runtimeStatus,
        llm: {
          ...runtimeStatus.llm,
          lastChatSource: payload.source,
          lastChatAt: new Date().toISOString()
        }
      };
    }
    if (payload?.reply?.content) return tagAssistantReplySource(payload.reply, payload.source);
  } catch {
    // Static-file previews can still use the deterministic local reply.
  }
  runtimeStatus = {
    ...runtimeStatus,
    llm: {
      ...runtimeStatus.llm,
      lastChatSource: 'local_fallback',
      lastChatAt: new Date().toISOString()
    }
  };
  return tagAssistantReplySource(
    createAssistantReply(companion, userMessage, priorMessages),
    'local_fallback'
  );
}

async function refreshRuntimeStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) return;
    runtimeStatus = await response.json();
    render();
  } catch {
    // Static preview mode has no status endpoint.
  }
}

async function saveModelSettings(form) {
  const data = new FormData(form);
  modelSettingsState = { saving: true, error: '', savedAt: null };
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
        apiMode: data.get('apiMode')
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Model save failed');
    runtimeStatus = {
      ...runtimeStatus,
      ...payload
    };
    modelSettingsState = { saving: false, error: '', savedAt: new Date().toISOString() };
  } catch (error) {
    modelSettingsState = {
      saving: false,
      error: error.message || 'Model save failed',
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

  const reply = await requestAssistantReply(updatedCompanion, userMessage, prior);
  state.messages = [...state.messages, reply];
  chatUiState = completeChatSend(chatUiState, companion.id);
  saveState();
  render();
  await refreshMemoryStatus(companion.id);
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

async function runLocalScheduler(now = new Date()) {
  const sourcesByCompanion = {};
  for (const companion of state.companions) {
    const sources = await retrieveSourcesFor(companion);
    if (sources) sourcesByCompanion[companion.id] = sources;
  }
  const result = runScheduledDailyPushes(state, {
    now: now.toISOString(),
    notificationPreferences,
    sourcesByCompanion
  });
  state = {
    ...result,
    notifications: undefined
  };
  schedulerStatus = {
    lastRunAt: now.toISOString(),
    lastNotifications: result.notifications,
    lastSourceMode: Object.keys(sourcesByCompanion).length > 0 ? 'external' : 'mock'
  };
  saveState();
  render();
}

function openCompanionDialog(mode = 'create') {
  if (mode === 'edit') {
    const companion = activeCompanion();
    editingCompanionId = companion.id;
    els.createForm.elements.name.value = companion.name;
    els.createForm.elements.relationshipType.value = companion.relationshipType;
    els.createForm.elements.personality.value = companion.personality;
    els.createForm.elements.pushTime.value = companion.pushSchedule.time;
    els.createForm.elements.maxDaily.value = companion.pushSchedule.maxDaily;
    els.createForm.elements.avatarStyle.value = companion.avatarStyle;
    els.createForm.elements.intimacyLevel.value = companion.careStyle?.intimacyLevel || 'gentle';
    els.createForm.elements.supportMode.value = companion.careStyle?.supportMode || 'listen_first';
    els.createForm.elements.proactiveCareFrequency.value = companion.careStyle?.proactiveCareFrequency || 'sometimes';
    els.createForm.elements.correctionMode.value = companion.practiceStyle?.correctionMode || 'after_reply';
    els.createForm.elements.correctionIntensity.value = companion.practiceStyle?.correctionIntensity || 'light';
    els.createForm.elements.replyLength.value = companion.practiceStyle?.replyLength || 'medium';
    setProviderFields(companion.contentSources?.enabledProviders);
    els.createForm.elements.customKeywords.value = (companion.customKeywords || []).join(', ');
    els.createForm.elements.memoryEnabled.checked = companion.memoryEnabled;
    els.createForm.elements.naturalPhrases.checked = companion.practiceStyle?.naturalPhrases !== false;
    renderCategoryFields(companion.pushCategories);
    els.saveCompanionButton.textContent = 'Save changes';
  } else {
    editingCompanionId = null;
    els.createForm.reset();
    renderCategoryFields();
    setProviderFields();
    els.saveCompanionButton.textContent = 'Create and chat';
  }
  renderCompanionPreview();
  els.createDialog.showModal();
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
  return {
    name: data.get('name'),
    relationshipType: data.get('relationshipType'),
    personality: data.get('personality'),
    pushCategories: data.getAll('pushCategories'),
    pushTime: data.get('pushTime'),
    maxDaily: data.get('maxDaily'),
    avatarStyle: data.get('avatarStyle'),
    careStyle: {
      intimacyLevel: data.get('intimacyLevel'),
      supportMode: data.get('supportMode'),
      proactiveCareFrequency: data.get('proactiveCareFrequency')
    },
    practiceStyle: {
      correctionMode: data.get('correctionMode'),
      correctionIntensity: data.get('correctionIntensity'),
      replyLength: data.get('replyLength'),
      naturalPhrases: data.get('naturalPhrases') === 'on'
    },
    contentSources: {
      enabledProviders: data.getAll('enabledProviders')
    },
    customKeywords: data.get('customKeywords'),
    memoryEnabled: data.get('memoryEnabled') === 'on'
  };
}

function renderCompanionPreview() {
  if (!els.companionPreview) return;
  const preview = generateCompanionPreview(companionInputFromForm(els.createForm));
  els.companionPreview.innerHTML = preview.messages.map((message) => {
    const label = message.role === 'user'
      ? 'You'
      : message.role === 'system_push'
        ? 'Daily Pick'
        : preview.companion.name;
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
  els.profileDialog.showModal();
}

function saveProfileFromForm(form) {
  const data = new FormData(form);
  state.user = updateUserProfile(state.user, {
    displayName: data.get('displayName'),
    email: data.get('email'),
    privacy: {
      localOnly: true,
      allowAiTraining: data.get('allowAiTraining') === 'on',
      showPrivacyNotice: data.get('showPrivacyNotice') === 'on'
    }
  });
  saveState();
  els.profileDialog.close();
  render();
}

function saveCompanionFromForm(form) {
  const input = companionInputFromForm(form);

  if (editingCompanionId) {
    state.companions = state.companions.map((companion) => (
      companion.id === editingCompanionId ? updateCompanion(companion, input) : companion
    ));
    saveState();
    editingCompanionId = null;
    els.createDialog.close();
    render();
    return;
  }

  const companion = createCompanion(input);
  state.companions = [...state.companions, companion];
  state.messages = [
    ...state.messages,
    {
      id: `msg_${companion.id}_welcome`,
      companionId: companion.id,
      role: 'assistant',
      content: `Hi, I'm ${companion.name}. I will chat with you in warm everyday English and bring you daily picks that match what you chose.`,
      createdAt: new Date().toISOString()
    }
  ];
  state.selectedCompanionId = companion.id;
  saveState();
  form.reset();
  renderCategoryFields();
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
  if (source === 'local_fallback') return 'Fallback';
  return 'Ready';
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

els.studioPanel.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
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
  if (action === 'toggle-notifications') {
    notificationPreferences = { ...notificationPreferences, enabled: !notificationPreferences.enabled };
    render();
  }
  if (action === 'toggle-quiet-hours') {
    notificationPreferences = {
      ...notificationPreferences,
      quietHours: {
        ...notificationPreferences.quietHours,
        enabled: !notificationPreferences.quietHours.enabled
      }
    };
    render();
  }
  if (action === 'edit-profile') openProfileDialog();
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
});
els.studioPanel.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-model-form]');
  if (!form) return;
  event.preventDefault();
  saveModelSettings(form);
});
els.studioPanel.addEventListener('change', (event) => {
  if (event.target.name !== 'provider') return;
  const form = event.target.closest('[data-model-form]');
  const option = runtimeStatus.modelOptions?.[event.target.value];
  if (!form || !option) return;
  form.elements.model.value = option.defaultModel || '';
  form.elements.baseUrl.value = option.baseUrl || '';
  form.elements.apiMode.value = option.apiMode || 'chat_completions';
});

els.openCreateButton.addEventListener('click', () => openCompanionDialog('create'));
els.closeCreateButton.addEventListener('click', () => {
  editingCompanionId = null;
  els.createDialog.close();
});
els.cancelCreateButton.addEventListener('click', () => {
  editingCompanionId = null;
  els.createDialog.close();
});
els.createForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveCompanionFromForm(els.createForm);
});
els.createForm.addEventListener('input', () => renderCompanionPreview());
els.createForm.addEventListener('change', () => renderCompanionPreview());
els.openProfileButton.addEventListener('click', () => openProfileDialog());
els.closeProfileButton.addEventListener('click', () => els.profileDialog.close());
els.cancelProfileButton.addEventListener('click', () => els.profileDialog.close());
els.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveProfileFromForm(els.profileForm);
});

renderCategoryFields();
setProviderFields();
renderCompanionPreview();
if (activeCompanion()) {
  readReceipts = markCompanionRead(readReceipts, activeCompanion().id);
  saveReadReceipts();
}
render();
refreshRuntimeStatus();
if (activeCompanion()) refreshMemoryStatus(activeCompanion().id);
runLocalScheduler();
setInterval(() => runLocalScheduler(), 60 * 1000);
