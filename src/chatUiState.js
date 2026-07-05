const PENDING_REPLY_TEXT = 'Thinking...';

export function canSendChatMessage(chatUiState, content) {
  return Boolean(String(content || '').trim()) && !chatUiState.pendingCompanionId;
}

export function beginChatSend(chatUiState, companionId) {
  return {
    ...chatUiState,
    pendingCompanionId: companionId,
    error: ''
  };
}

export function completeChatSend(chatUiState, companionId, error = '') {
  if (chatUiState.pendingCompanionId !== companionId) return chatUiState;
  return {
    ...chatUiState,
    pendingCompanionId: null,
    error
  };
}

export function buildRenderableMessages(messages, options = {}) {
  const visibleMessages = messages.filter((message) => message.companionId === options.companionId);
  if (options.pendingCompanionId !== options.companionId) return visibleMessages;
  return [
    ...visibleMessages,
    {
      id: `pending_${options.companionId}`,
      companionId: options.companionId,
      role: 'assistant_pending',
      content: PENDING_REPLY_TEXT,
      createdAt: new Date().toISOString(),
      pending: true
    }
  ];
}

export function tagAssistantReplySource(reply, source) {
  return {
    ...reply,
    metadata: {
      ...(reply.metadata || {}),
      chatSource: source || 'local_fallback'
    }
  };
}

export function createDailyPushActions({ companion, message }) {
  const category = message?.metadata?.category;
  if (message?.role !== 'system_push' || !category) return [];

  const categories = companion?.pushCategories || [];
  const disabled = categories.length <= 1 || !categories.includes(category);
  return [
    {
      action: 'save-pick',
      category,
      label: 'Save pick',
      disabled: false
    },
    {
      action: 'stop-category',
      category,
      label: disabled ? 'Only category left' : 'Stop this type',
      disabled
    }
  ];
}

export function countUnreadCompanionMessages(messages, options = {}) {
  const since = options.lastReadAt ? new Date(options.lastReadAt).getTime() : 0;
  return messages.filter((message) => {
    if (message.companionId !== options.companionId) return false;
    if (!['assistant', 'system_push'].includes(message.role)) return false;
    return new Date(message.createdAt).getTime() > since;
  }).length;
}

export function markCompanionRead(readReceipts, companionId, readAt = new Date().toISOString()) {
  return {
    ...(readReceipts || {}),
    [companionId]: readAt
  };
}
