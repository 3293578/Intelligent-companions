const MAX_TEXT_LENGTH = 280;
const MAX_CONTEXT_LENGTH = 600;

export async function parseTranslateProxyRequest(request) {
  if (request.method !== 'POST') {
    throw new Error('Translate proxy expects POST requests.');
  }
  const body = await request.json();
  const text = String(body?.text || '').trim();
  if (!text) {
    throw new Error('Translate proxy request requires text.');
  }
  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    context: String(body?.context || '').trim().slice(0, MAX_CONTEXT_LENGTH),
    targetLanguage: String(body?.targetLanguage || '').trim()
  };
}

export function detectTranslationTarget(text, targetLanguage = '') {
  if (targetLanguage) return targetLanguage;
  const hasCjk = /[一-鿿぀-ヿ가-힯]/.test(text);
  return hasCjk ? 'English' : 'Chinese';
}

export function buildTranslateMessages({ text, context, targetLanguage }) {
  const target = detectTranslationTarget(text, targetLanguage);
  const contextLine = context
    ? `The selected text appears inside this sentence or message: "${context}"`
    : 'No extra context was provided.';

  return [
    {
      role: 'system',
      content: [
        'You are a precise bilingual dictionary and language tutor inside an English learning companion app.',
        `Translate the selected text into ${target}.`,
        'Respond with ONLY a JSON object, no markdown fences, using exactly these keys:',
        '{"translation": string, "pronunciation": string, "explanation": string, "examples": [string, string]}',
        'Rules:',
        '- "translation" is the most natural translation for how the text is used in its context.',
        '- "pronunciation" is IPA for single English words or pinyin for Chinese; empty string if not useful.',
        '- "explanation" is one or two short sentences in Chinese explaining meaning, nuance, and usage.',
        '- "examples" holds up to two short bilingual example sentences (target language sentence + Chinese translation in the same string).',
        '- Keep everything compact. Do not add any keys or commentary.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Selected text: "${text}"`,
        contextLine
      ].join('\n')
    }
  ];
}

export function parseTranslationPayload(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const unfenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    const translation = String(parsed?.translation || '').trim();
    if (!translation) return null;
    return {
      translation,
      pronunciation: String(parsed.pronunciation || '').trim(),
      explanation: String(parsed.explanation || '').trim(),
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
        : []
    };
  } catch {
    return null;
  }
}

export function createLocalTranslationFallback(text) {
  return {
    translation: '',
    pronunciation: '',
    explanation: `暂时无法翻译“${text}”。请在右侧 Model 卡片配置可用的模型 API key（如 DEEPSEEK_API_KEY）后重试。`,
    examples: []
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

function resolveLlmClient(options) {
  if (typeof options.llmClientProvider === 'function') {
    return options.llmClientProvider();
  }
  return options.llmClient;
}

export function createTranslateProxyHandler(options = {}) {
  return async function handleTranslateProxy(request) {
    try {
      const parsed = await parseTranslateProxyRequest(request);
      const target = detectTranslationTarget(parsed.text, parsed.targetLanguage);
      const llmClient = resolveLlmClient(options);

      if (typeof llmClient === 'function') {
        try {
          const raw = await llmClient(buildTranslateMessages(parsed));
          const result = parseTranslationPayload(raw);
          if (result) {
            return jsonResponse({
              source: 'llm',
              text: parsed.text,
              targetLanguage: target,
              result
            });
          }
        } catch (error) {
          options.onLlmError?.(error);
          // Fall through to the deterministic local fallback.
        }
      }

      return jsonResponse({
        source: 'local_fallback',
        text: parsed.text,
        targetLanguage: target,
        result: createLocalTranslationFallback(parsed.text)
      });
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }
  };
}
