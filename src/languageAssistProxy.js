const MAX_TEXT_LENGTH = 280;
const MAX_CONTEXT_LENGTH = 600;

export async function parseLanguageAssistRequest(request) {
  if (request.method !== 'POST') throw new Error('Language assist expects POST requests.');
  const body = await request.json();
  const text = String(body?.text || '').trim();
  if (!text) throw new Error('Language assist requires text.');
  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    context: String(body?.context || '').trim().slice(0, MAX_CONTEXT_LENGTH),
    language: String(body?.language || 'English').trim() || 'English'
  };
}

export function buildLanguageAssistMessages({ text, context, language }) {
  return [
    {
      role: 'system',
      content: [
        'The user explicitly requested help making a phrase sound more natural.',
        `Rewrite it in natural ${language || 'English'} without changing the intended meaning.`,
        'Return ONLY JSON with keys naturalAlternative and note.',
        'Keep the note short and supportive. Do not add unsolicited correction or judgment.'
      ].join('\n')
    },
    { role: 'user', content: `Selected text: "${text}"\nContext: "${context || ''}"` }
  ];
}

export function parseLanguageAssistPayload(raw) {
  if (typeof raw !== 'string') return null;
  const unfenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    const naturalAlternative = String(parsed?.naturalAlternative || '').trim();
    if (!naturalAlternative) return null;
    return { naturalAlternative, note: String(parsed?.note || '').trim() };
  } catch {
    return null;
  }
}

function response(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  };
}

export function createLanguageAssistProxyHandler(options = {}) {
  return async function handleLanguageAssist(request) {
    try {
      const parsed = await parseLanguageAssistRequest(request);
      const llmClient = typeof options.llmClientProvider === 'function' ? options.llmClientProvider() : options.llmClient;
      if (typeof llmClient === 'function') {
        try {
          const result = parseLanguageAssistPayload(await llmClient(buildLanguageAssistMessages(parsed)));
          if (result) return response({ source: 'llm', result });
        } catch (error) {
          options.onLlmError?.(error);
        }
      }
      return response({ source: 'local_fallback', result: { naturalAlternative: parsed.text, note: 'Natural phrasing is unavailable until a model is configured.' } });
    } catch (error) {
      return response({ error: error.message }, 400);
    }
  };
}
