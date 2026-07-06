const DEFAULT_LIMIT = 200;

function createId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `vocab_${Date.now().toString(36)}_${random}`;
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

export function createVocabEntry(input = {}) {
  const text = String(input.text || '').trim();
  if (!text) return null;
  return {
    id: input.id || createId(),
    text,
    translation: String(input.translation || '').trim(),
    pronunciation: String(input.pronunciation || '').trim(),
    explanation: String(input.explanation || '').trim(),
    examples: Array.isArray(input.examples)
      ? input.examples.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
      : [],
    companionId: input.companionId || '',
    targetLanguage: input.targetLanguage || '',
    savedAt: input.savedAt || new Date().toISOString()
  };
}

export function addVocabEntry(list, input, limit = DEFAULT_LIMIT) {
  const entry = createVocabEntry(input);
  if (!entry) return Array.isArray(list) ? list : [];
  const existing = Array.isArray(list) ? list : [];
  const key = normalizeText(entry.text);
  return [
    entry,
    ...existing.filter((item) => normalizeText(item.text) !== key)
  ].slice(0, limit);
}

export function removeVocabEntry(list, id) {
  return (Array.isArray(list) ? list : []).filter((item) => item.id !== id);
}

export function deserializeVocabBook(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => createVocabEntry(item))
      .filter(Boolean)
      .slice(0, DEFAULT_LIMIT);
  } catch {
    return [];
  }
}

export function serializeVocabBook(list) {
  return JSON.stringify(Array.isArray(list) ? list : []);
}
