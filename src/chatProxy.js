import {
  buildCompanionSystemPrompt,
  createAssistantReply,
  detectUserEmotion
} from './companionLogic.js';
import { formatMemoryForPrompt } from './memoryStore.js';

export async function parseChatProxyRequest(request) {
  if (request.method !== 'POST') {
    throw new Error('Chat proxy expects POST requests.');
  }
  const body = await request.json();
  if (!body?.companion || !body?.userMessage) {
    throw new Error('Chat proxy request requires companion and userMessage.');
  }
  return {
    companion: body.companion,
    userMessage: body.userMessage,
    priorMessages: Array.isArray(body.priorMessages) ? body.priorMessages : []
  };
}

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

function createAssistantMessage(companionId, content, metadata = {}) {
  return {
    id: `msg_${Date.now().toString(36)}`,
    companionId,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
    metadata
  };
}

function companionWithBackendMemory(companion, memoryProfile) {
  if (!memoryProfile) return companion;
  const memorySummary = formatMemoryForPrompt(memoryProfile);
  if (!memorySummary) return companion;
  return {
    ...companion,
    memorySummary: [
      companion.memorySummary,
      `Long-term memory:\n${memorySummary}`
    ].filter(Boolean).join('\n')
  };
}

function toLlmMessages(companion, userMessage, priorMessages, memoryProfile) {
  const promptedCompanion = companionWithBackendMemory(companion, memoryProfile);
  const recentMessages = priorMessages
    .filter((message) => (
      message.companionId === companion.id
      && ['user', 'assistant'].includes(message.role)
    ))
    .slice(-8)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));

  return [
    {
      role: 'system',
      content: buildCompanionSystemPrompt(promptedCompanion)
    },
    ...recentMessages,
    {
      role: 'user',
      content: userMessage.content
    }
  ];
}

async function requestLlmContent(llmClient, messages) {
  const result = await llmClient(messages);
  if (typeof result === 'function') return result(messages);
  return result;
}

function resolveLlmClient(options) {
  if (typeof options.llmClientProvider === 'function') {
    return options.llmClientProvider();
  }
  return options.llmClient;
}

export function createChatProxyHandler(options = {}) {
  return async function handleChatProxy(request) {
    try {
      const { companion, userMessage, priorMessages } = await parseChatProxyRequest(request);
      let memoryProfile = null;
      if (companion.memoryEnabled && options.memoryStore) {
        try {
          memoryProfile = await options.memoryStore.remember(companion.id, userMessage);
        } catch (error) {
          options.onMemoryError?.(error);
        }
      }
      const llmClient = resolveLlmClient(options);
      if (typeof llmClient === 'function') {
        try {
          const messages = toLlmMessages(companion, userMessage, priorMessages, memoryProfile);
          const content = await requestLlmContent(llmClient, messages);
          if (content) {
            return jsonResponse({
              reply: createAssistantMessage(companion.id, content, {
                emotion: detectUserEmotion(userMessage.content)
              }),
              source: 'llm'
            });
          }
        } catch (error) {
          options.onLlmError?.(error);
          // Fall through to deterministic local behavior.
        }
      }

      return jsonResponse({
        reply: createAssistantReply(companion, userMessage, priorMessages),
        source: 'local_fallback'
      });
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }
  };
}
