import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChatProxyHandler,
  parseChatProxyRequest
} from '../src/chatProxy.js';

import { createCompanion, createUserMessage } from '../src/companionLogic.js';

test('parseChatProxyRequest accepts companion, user message, and prior messages', async () => {
  const companion = createCompanion({ name: 'Luna' });
  const userMessage = createUserMessage(companion.id, 'I had a long day.');

  const parsed = await parseChatProxyRequest({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages: []
    })
  });

  assert.equal(parsed.companion.name, 'Luna');
  assert.equal(parsed.userMessage.content, 'I had a long day.');
});

test('chat proxy handler uses an LLM client when available', async () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    personality: 'Gentle and playful'
  });
  const userMessage = createUserMessage(companion.id, 'I feel proud today.');
  const calls = [];
  const handler = createChatProxyHandler({
    llmClient: async (messages) => {
      calls.push(messages);
      return 'Awww, I am proud of you too. Tell me what happened today.';
    }
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages: []
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.reply.role, 'assistant');
  assert.match(body.reply.content, /proud of you/);
  assert.match(calls[0][0].content, /You are Luna/);
});

test('chat proxy tags LLM replies with detected user emotion metadata', async () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend'
  });
  const userMessage = createUserMessage(companion.id, 'I feel anxious before my interview.');
  const handler = createChatProxyHandler({
    llmClient: async () => 'Come here, breathe with me first. We can make this smaller together.'
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages: []
    })
  });
  const body = await response.json();

  assert.equal(body.reply.metadata.emotion.label, 'anxious');
  assert.equal(body.reply.metadata.emotion.valence, 'negative');
});

test('chat proxy can resolve a fresh LLM client for runtime model switching', async () => {
  const companion = createCompanion({ name: 'Luna' });
  const userMessage = createUserMessage(companion.id, 'Hi');
  const clients = [
    async () => 'First model reply.',
    async () => 'Second model reply.'
  ];
  const handler = createChatProxyHandler({
    llmClient: () => clients.shift()
  });

  const first = await handler({
    method: 'POST',
    json: async () => ({ companion, userMessage, priorMessages: [] })
  });
  const second = await handler({
    method: 'POST',
    json: async () => ({ companion, userMessage, priorMessages: [] })
  });

  assert.equal((await first.json()).reply.content, 'First model reply.');
  assert.equal((await second.json()).reply.content, 'Second model reply.');
});

test('chat proxy uses an explicit LLM client provider for runtime model switching', async () => {
  const companion = createCompanion({ name: 'Luna' });
  const userMessage = createUserMessage(companion.id, 'Hi again');
  const selectedModels = ['deepseek reply', 'openai reply'];
  const handler = createChatProxyHandler({
    llmClientProvider: () => async () => selectedModels.shift()
  });

  const first = await handler({
    method: 'POST',
    json: async () => ({ companion, userMessage, priorMessages: [] })
  });
  const second = await handler({
    method: 'POST',
    json: async () => ({ companion, userMessage, priorMessages: [] })
  });

  assert.equal((await first.json()).reply.content, 'deepseek reply');
  assert.equal((await second.json()).reply.content, 'openai reply');
});

test('chat proxy stores user memory and sends backend memory to the LLM prompt', async () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    memoryEnabled: true
  });
  const userMessage = createUserMessage(companion.id, 'My cat Mochi is shy and I prefer warm encouragement.');
  const remembered = [];
  const calls = [];
  const handler = createChatProxyHandler({
    memoryStore: {
      async remember(companionId, message) {
        remembered.push({ companionId, message });
        return {
          companionId,
          memories: {
            fact: [{ text: 'User fact: User has a cat named Mochi.' }],
            preference: [{ text: 'User preference: User prefers warm encouragement.' }],
            emotional_pattern: [],
            recent_event: []
          }
        };
      }
    },
    llmClient: async (messages) => {
      calls.push(messages);
      return 'I remember Mochi and I will keep it warm.';
    }
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages: []
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(remembered[0].companionId, companion.id);
  assert.equal(remembered[0].message.content, userMessage.content);
  assert.match(calls[0][0].content, /Long-term memory/);
  assert.match(calls[0][0].content, /Mochi/);
  assert.match(calls[0][0].content, /warm encouragement/);
  assert.match(body.reply.content, /Mochi/);
});

test('chat proxy sends only recent chat messages for the selected companion to the LLM', async () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    relationshipType: 'Girlfriend'
  });
  const otherCompanion = createCompanion({
    id: 'companion_alex',
    name: 'Alex'
  });
  const chatMessages = Array.from({ length: 10 }, (_, index) => ({
      id: `msg_${index}`,
      companionId: companion.id,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `chat ${index}`,
      createdAt: `2026-07-04T07:${String(index + 2).padStart(2, '0')}:00.000Z`
  }));
  const priorMessages = [
    ...chatMessages.slice(0, 6),
    {
      id: 'push_luna',
      companionId: companion.id,
      role: 'system_push',
      content: 'Daily Pick from Luna: very long news link that should not enter chat context.',
      createdAt: '2026-07-04T07:08:30.000Z'
    },
    {
      id: 'other_user',
      companionId: otherCompanion.id,
      role: 'user',
      content: 'Other companion context should stay separate.',
      createdAt: '2026-07-04T07:08:45.000Z'
    },
    ...chatMessages.slice(6)
  ];
  const userMessage = createUserMessage(companion.id, 'current message');
  const calls = [];
  const handler = createChatProxyHandler({
    llmClient: async (messages) => {
      calls.push(messages);
      return 'I am here with you.';
    }
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    calls[0].map((message) => message.content),
    [
      calls[0][0].content,
      'chat 2',
      'chat 3',
      'chat 4',
      'chat 5',
      'chat 6',
      'chat 7',
      'chat 8',
      'chat 9',
      'current message'
    ]
  );
  assert.equal(calls[0][0].role, 'system');
  assert.ok(calls[0].every((message) => !message.content.includes('Daily Pick')));
  assert.ok(calls[0].every((message) => !message.content.includes('Other companion')));
});

test('chat proxy handler falls back to local reply when LLM client fails', async () => {
  const companion = createCompanion({
    name: 'Mia',
    relationshipType: 'Bestie'
  });
  const userMessage = createUserMessage(companion.id, 'I feel sad today.');
  const handler = createChatProxyHandler({
    llmClient: async () => {
      throw new Error('model offline');
    }
  });

  const response = await handler({
    method: 'POST',
    json: async () => ({
      companion,
      userMessage,
      priorMessages: []
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.reply.content, /Mia/);
  assert.match(body.reply.content, /not alone|listen/i);
  assert.equal(body.source, 'local_fallback');
});
