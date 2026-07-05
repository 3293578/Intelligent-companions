import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginChatSend,
  buildRenderableMessages,
  canSendChatMessage,
  completeChatSend,
  createDailyPushActions,
  countUnreadCompanionMessages,
  markCompanionRead,
  tagAssistantReplySource
} from '../src/chatUiState.js';

test('blocks duplicate sends while a companion reply is pending', () => {
  const idle = { pendingCompanionId: null, error: '' };
  const pending = beginChatSend(idle, 'companion_luna');

  assert.equal(canSendChatMessage(idle, 'hello'), true);
  assert.equal(canSendChatMessage(pending, 'hello again'), false);
  assert.equal(canSendChatMessage(pending, '   '), false);
  assert.deepEqual(pending, {
    pendingCompanionId: 'companion_luna',
    error: ''
  });
});

test('clears pending state only for the matching companion request', () => {
  const pending = beginChatSend({ pendingCompanionId: null, error: '' }, 'companion_luna');

  assert.equal(completeChatSend(pending, 'companion_alex').pendingCompanionId, 'companion_luna');
  assert.equal(completeChatSend(pending, 'companion_luna').pendingCompanionId, null);
});

test('adds a temporary pending message to the active companion transcript', () => {
  const messages = [
    {
      id: 'msg_user',
      companionId: 'companion_luna',
      role: 'user',
      content: 'I had a long day.',
      createdAt: '2026-07-04T08:00:00.000Z'
    }
  ];

  const rendered = buildRenderableMessages(messages, {
    companionId: 'companion_luna',
    pendingCompanionId: 'companion_luna'
  });

  assert.equal(rendered.length, 2);
  assert.equal(rendered[1].role, 'assistant_pending');
  assert.equal(rendered[1].companionId, 'companion_luna');
  assert.match(rendered[1].content, /thinking/i);
});

test('does not show pending message on other companions', () => {
  const rendered = buildRenderableMessages([], {
    companionId: 'companion_alex',
    pendingCompanionId: 'companion_luna'
  });

  assert.deepEqual(rendered, []);
});

test('tags assistant replies with model or fallback source metadata', () => {
  const reply = {
    id: 'msg_reply',
    companionId: 'companion_luna',
    role: 'assistant',
    content: 'Hi there.',
    createdAt: '2026-07-04T08:00:02.000Z'
  };

  assert.equal(tagAssistantReplySource(reply, 'llm').metadata.chatSource, 'llm');
  assert.equal(tagAssistantReplySource(reply, 'local_fallback').metadata.chatSource, 'local_fallback');
});

test('creates message-level save and unsubscribe actions for daily push categories', () => {
  const actions = createDailyPushActions({
    companion: {
      pushCategories: ['funny_videos', 'music']
    },
    message: {
      role: 'system_push',
      metadata: {
        category: 'funny_videos'
      }
    }
  });

  assert.deepEqual(actions, [
    {
      action: 'save-pick',
      category: 'funny_videos',
      label: 'Save pick',
      disabled: false
    },
    {
      action: 'stop-category',
      category: 'funny_videos',
      label: 'Stop this type',
      disabled: false
    }
  ]);
});

test('disables daily push unsubscribe when it would remove the final category', () => {
  const actions = createDailyPushActions({
    companion: {
      pushCategories: ['music']
    },
    message: {
      role: 'system_push',
      metadata: {
        category: 'music'
      }
    }
  });

  assert.equal(actions[0].action, 'save-pick');
  assert.equal(actions[1].disabled, true);
  assert.equal(actions[1].label, 'Only category left');
});

test('counts unread assistant and daily push messages since a companion was last read', () => {
  const messages = [
    {
      companionId: 'companion_luna',
      role: 'assistant',
      content: 'Old hello',
      createdAt: '2026-07-04T08:00:00.000Z'
    },
    {
      companionId: 'companion_luna',
      role: 'user',
      content: 'My own unread draft should not count',
      createdAt: '2026-07-04T09:00:00.000Z'
    },
    {
      companionId: 'companion_luna',
      role: 'system_push',
      content: 'New Daily Pick',
      createdAt: '2026-07-04T10:00:00.000Z'
    },
    {
      companionId: 'companion_alex',
      role: 'assistant',
      content: 'Other companion',
      createdAt: '2026-07-04T10:30:00.000Z'
    }
  ];

  assert.equal(countUnreadCompanionMessages(messages, {
    companionId: 'companion_luna',
    lastReadAt: '2026-07-04T08:30:00.000Z'
  }), 1);
});

test('marks a companion as read without losing existing read receipts', () => {
  const readState = markCompanionRead({
    companion_alex: '2026-07-04T08:00:00.000Z'
  }, 'companion_luna', '2026-07-04T11:00:00.000Z');

  assert.deepEqual(readState, {
    companion_alex: '2026-07-04T08:00:00.000Z',
    companion_luna: '2026-07-04T11:00:00.000Z'
  });
});
