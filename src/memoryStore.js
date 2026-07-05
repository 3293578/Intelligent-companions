import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MEMORY_TYPES = ['fact', 'preference', 'emotional_pattern', 'recent_event'];

export const MEMORY_LIMITS = {
  perType: 8,
  entryTextChars: 180,
  promptChars: 1200,
  maxProfileBytes: 16000
};

function emptyMemoryBuckets() {
  return Object.fromEntries(MEMORY_TYPES.map((type) => [type, []]));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  const text = normalizeText(value);
  if (text.length <= MEMORY_LIMITS.entryTextChars) return text;
  return `${text.slice(0, MEMORY_LIMITS.entryTextChars - 1).trim()}.`;
}

function memoryKey(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function createEntry(type, text, now) {
  return {
    type,
    text: compactText(text),
    createdAt: now,
    updatedAt: now,
    strength: 1
  };
}

function sentenceFragments(content) {
  return normalizeText(content)
    .split(/[.!?\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
}

function looksLikePreference(text) {
  return /\b(i like|i love|i prefer|please remember|don't|do not|favorite|favourite|i hate|i dislike)\b/i.test(text);
}

function looksLikeEmotion(text) {
  return /\b(anxious|stress|stressed|sad|lonely|tired|worried|afraid|happy|proud|excited|overwhelmed|feel|feeling)\b/i.test(text);
}

function looksLikeRecentEvent(text) {
  return /\b(today|tomorrow|yesterday|this week|next week|interview|exam|meeting|deadline|work|school|trip)\b/i.test(text);
}

function looksLikeFact(text) {
  return /\b(my|i am|i'm|i have|i live|i work|my cat|my dog|named|called)\b/i.test(text);
}

function preferenceMemory(fragment) {
  const match = fragment.match(/\b(i like|i love|i prefer|i hate|i dislike|please remember|favorite|favourite|don't|do not)\b(.{0,90})/i);
  return match ? `User preference: ${normalizeText(`${match[1]}${match[2]}`)}.` : `User preference: ${fragment}.`;
}

function emotionMemory(fragment) {
  const match = fragment.match(/\b(anxious|stress|stressed|sad|lonely|tired|worried|afraid|happy|proud|excited|overwhelmed)\b.{0,70}/i);
  return match ? `Emotional cue: User can feel ${normalizeText(match[0])}.` : `Emotional cue: ${fragment}.`;
}

function factMemory(fragment) {
  const petMatch = fragment.match(/\bmy\s+(cat|dog|pet)\s+([A-Z][\w-]*)\b/i);
  if (petMatch) return `User fact: User has a ${petMatch[1].toLowerCase()} named ${petMatch[2]}.`;
  const namedMatch = fragment.match(/\b(my\s+\w+)\s+(?:is\s+)?(?:named|called)\s+([A-Z][\w-]*)\b/i);
  if (namedMatch) return `User fact: ${namedMatch[1]} is named ${namedMatch[2]}.`;
  return `User fact: ${fragment}.`;
}

function recentEventMemory(fragment) {
  const eventMatch = fragment.match(/\b(today|tomorrow|yesterday|this week|next week|interview|exam|meeting|deadline|work|school|trip)\b.{0,70}/i);
  return eventMatch ? `Recent context: ${normalizeText(eventMatch[0])}.` : `Recent context: ${fragment}.`;
}

export function extractMemoryEntries(userMessage, now = new Date().toISOString()) {
  const fragments = sentenceFragments(userMessage?.content);
  const entries = [];

  for (const fragment of fragments) {
    if (looksLikeFact(fragment)) entries.push(createEntry('fact', factMemory(fragment), now));
    if (looksLikePreference(fragment)) entries.push(createEntry('preference', preferenceMemory(fragment), now));
    if (looksLikeEmotion(fragment)) entries.push(createEntry('emotional_pattern', emotionMemory(fragment), now));
    if (looksLikeRecentEvent(fragment)) entries.push(createEntry('recent_event', recentEventMemory(fragment), now));
  }

  return entries.filter((entry, index, all) => (
    index === all.findIndex((candidate) => (
      candidate.type === entry.type && memoryKey(candidate.text) === memoryKey(entry.text)
    ))
  ));
}

function normalizeProfile(profile = {}, companionId = '') {
  const memories = emptyMemoryBuckets();
  for (const type of MEMORY_TYPES) {
    memories[type] = Array.isArray(profile.memories?.[type])
      ? profile.memories[type].map((entry) => ({
        type,
        text: compactText(entry.text),
        createdAt: entry.createdAt || new Date(0).toISOString(),
        updatedAt: entry.updatedAt || entry.createdAt || new Date(0).toISOString(),
        strength: Number(entry.strength || 1)
      })).filter((entry) => entry.text)
      : [];
  }

  return {
    companionId: profile.companionId || companionId,
    updatedAt: profile.updatedAt || '',
    memories,
    approxBytes: Number(profile.approxBytes || 0)
  };
}

function withApproxBytes(profile) {
  return {
    ...profile,
    approxBytes: Buffer.byteLength(JSON.stringify(profile), 'utf8')
  };
}

function createEmptyProfile(companionId, now = '') {
  return withApproxBytes({
    companionId,
    updatedAt: now,
    memories: emptyMemoryBuckets(),
    approxBytes: 0
  });
}

export function mergeMemoryProfile(profile = {}, entries = [], now = new Date().toISOString()) {
  const next = normalizeProfile(profile, profile.companionId);
  next.updatedAt = now;

  for (const entry of entries) {
    if (!MEMORY_TYPES.includes(entry.type) || !entry.text) continue;
    const bucket = next.memories[entry.type];
    const key = memoryKey(entry.text);
    const existing = bucket.find((item) => memoryKey(item.text) === key);
    if (existing) {
      existing.updatedAt = entry.updatedAt || now;
      existing.strength = Number(existing.strength || 1) + 1;
      continue;
    }
    bucket.push({
      ...entry,
      text: compactText(entry.text),
      createdAt: entry.createdAt || now,
      updatedAt: now,
      strength: Number(entry.strength || 1)
    });
  }

  for (const type of MEMORY_TYPES) {
    next.memories[type] = next.memories[type]
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      .slice(-MEMORY_LIMITS.perType);
  }

  return withApproxBytes(next);
}

export function formatMemoryForPrompt(profile = {}) {
  const normalized = normalizeProfile(profile, profile.companionId);
  const labels = {
    fact: 'Known facts',
    preference: 'Preferences',
    emotional_pattern: 'Emotional patterns',
    recent_event: 'Recent context'
  };
  const sections = [];

  for (const type of MEMORY_TYPES) {
    const items = normalized.memories[type];
    if (items.length === 0) continue;
    sections.push(`${labels[type]}: ${items.map((item) => item.text).join(' ')}`);
  }

  const summary = sections.join('\n');
  if (summary.length <= MEMORY_LIMITS.promptChars) return summary;
  return `${summary.slice(0, MEMORY_LIMITS.promptChars - 1).trim()}.`;
}

async function readAllProfiles(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAllProfiles(filePath, profiles) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
}

export function createMemoryStore(filePath) {
  return {
    async getProfile(companionId) {
      const profiles = await readAllProfiles(filePath);
      return normalizeProfile(profiles[companionId], companionId);
    },

    async remember(companionId, userMessage, options = {}) {
      const now = options.now || new Date().toISOString();
      const profiles = await readAllProfiles(filePath);
      const current = normalizeProfile(profiles[companionId], companionId);
      const entries = extractMemoryEntries(userMessage, now);
      const next = mergeMemoryProfile(current, entries, now);
      profiles[companionId] = next;
      await writeAllProfiles(filePath, profiles);
      return next;
    },

    async clearProfile(companionId, options = {}) {
      const now = options.now || new Date().toISOString();
      const profiles = await readAllProfiles(filePath);
      const next = createEmptyProfile(companionId, now);
      profiles[companionId] = next;
      await writeAllProfiles(filePath, profiles);
      return next;
    }
  };
}
