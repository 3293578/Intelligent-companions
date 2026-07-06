const DEFAULT_CATEGORIES = ['funny_videos', 'world_news', 'tech_news'];
const DEFAULT_CONTENT_PROVIDERS = ['youtube', 'news', 'reddit', 'web_search'];

const LANGUAGE_LIBRARY = {
  english: {
    label: 'English', name: 'English', nativeLabel: 'English', translateTarget: 'English',
    welcome: "Hi, I'm {name}. I'll chat with you in warm, everyday English and bring you daily picks that match what you chose.",
    checkIn: '{name} here — just checking in on you. How are you feeling today, really?'
  },
  japanese: {
    label: 'Japanese', name: 'Japanese', nativeLabel: '日本語', translateTarget: 'Japanese',
    welcome: 'こんにちは、{name}だよ。毎日やさしい日本語でおしゃべりしながら、あなたに合わせたおすすめも届けるね。',
    checkIn: '{name}だよ。ちょっと様子を見に来たよ。今日はどんな気分？'
  },
  korean: {
    label: 'Korean', name: 'Korean', nativeLabel: '한국어', translateTarget: 'Korean',
    welcome: '안녕, 나는 {name}이야. 매일 따뜻하고 자연스러운 한국어로 이야기하고, 네 취향에 맞는 소식도 가져다줄게.',
    checkIn: '나 {name}이야. 그냥 네가 어떻게 지내는지 궁금해서 왔어. 오늘 기분은 좀 어때?'
  },
  french: {
    label: 'French', name: 'French', nativeLabel: 'Français', translateTarget: 'French',
    welcome: "Salut, je suis {name}. On va discuter en français simple et chaleureux, et je t'apporterai des trouvailles qui te ressemblent.",
    checkIn: "C'est {name}. Je prends juste de tes nouvelles. Comment tu te sens aujourd'hui, vraiment ?"
  },
  spanish: {
    label: 'Spanish', name: 'Spanish', nativeLabel: 'Español', translateTarget: 'Spanish',
    welcome: 'Hola, soy {name}. Charlaré contigo en un español cálido y cotidiano y te traeré recomendaciones a tu medida.',
    checkIn: 'Soy {name}. Solo quería ver cómo estás. ¿Cómo te sientes hoy, de verdad?'
  },
  german: {
    label: 'German', name: 'German', nativeLabel: 'Deutsch', translateTarget: 'German',
    welcome: 'Hi, ich bin {name}. Ich plaudere mit dir in warmem, alltäglichem Deutsch und bringe dir passende Empfehlungen.',
    checkIn: 'Hier ist {name}. Ich wollte nur mal nach dir sehen. Wie geht es dir heute wirklich?'
  },
  italian: {
    label: 'Italian', name: 'Italian', nativeLabel: 'Italiano', translateTarget: 'Italian',
    welcome: 'Ciao, sono {name}. Chiacchiererò con te in un italiano caldo e quotidiano e ti porterò contenuti scelti per te.',
    checkIn: 'Sono {name}. Volevo solo sapere come stai. Come ti senti davvero oggi?'
  }
};

const DEFAULT_LANGUAGE = 'english';

const CATEGORY_LIBRARY = {
  funny_videos: {
    label: 'Funny video',
    title: 'A tiny comedy sketch for English learners',
    url: 'https://example.com/funny-english-video',
    opener: 'I found a short funny video that feels perfect for a quick mood reset'
  },
  world_news: {
    label: 'World news',
    title: 'A calm five-minute world news briefing',
    url: 'https://example.com/world-news-briefing',
    opener: 'I picked a concise world news briefing so you can stay informed without feeling flooded'
  },
  tech_news: {
    label: 'Tech news',
    title: 'A readable breakdown of today in AI tools',
    url: 'https://example.com/ai-tools-update',
    opener: 'I spotted a clear tech update that sounds very you'
  },
  psychology: {
    label: 'Psychology',
    title: 'A gentle note on emotional regulation',
    url: 'https://example.com/emotional-regulation-note',
    opener: 'I saved a psychology piece that might help you name what you are feeling'
  },
  healing_news: {
    label: 'Healing news',
    title: 'A kind story from a community garden',
    url: 'https://example.com/healing-community-story',
    opener: 'I found a soft little story that made the world feel kinder for a minute'
  },
  music: {
    label: 'Music',
    title: 'A mellow English playlist for winding down',
    url: 'https://example.com/mellow-english-playlist',
    opener: 'I picked a mellow playlist that could sit beside your evening like a warm lamp'
  },
  deep_reads: {
    label: 'Deep read',
    title: 'A thoughtful essay about focus and modern life',
    url: 'https://example.com/focus-modern-life',
    opener: 'I found a deeper read that might be worth thinking over together'
  },
  local_events: {
    label: 'Local events',
    title: 'A weekend event idea to explore in English',
    url: 'https://example.com/local-event-idea',
    opener: 'I picked a local-style event idea in case you want something fresh to look forward to'
  },
  daily_jokes: {
    label: 'Daily joke',
    title: 'A clean little joke for English practice',
    url: 'https://example.com/daily-clean-joke',
    opener: 'I saved a tiny clean joke because your day deserves one easy laugh'
  },
  internet_memes: {
    label: 'Internet meme',
    title: 'A wholesome internet meme with simple English',
    url: 'https://example.com/wholesome-internet-meme',
    opener: 'I found a harmless internet meme that felt silly enough to share with you'
  }
};

const MOCK_CONTENT_SOURCES = [
  {
    id: 'funny-video-skit',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'A playful English skit about ordering coffee',
    summary: 'A short, light video with everyday phrases and a tiny twist.',
    url: 'https://example.com/funny-english-video',
    safety: 'safe'
  },
  {
    id: 'world-news-brief',
    category: 'world_news',
    sourceType: 'news',
    title: 'A calm five-minute world news briefing',
    summary: 'A concise update written for people who want context without doomscrolling.',
    url: 'https://example.com/world-news-briefing',
    safety: 'safe'
  },
  {
    id: 'ai-tools-update',
    category: 'tech_news',
    sourceType: 'news',
    title: 'A readable breakdown of today in AI tools',
    summary: 'A practical overview of new AI product patterns and what they mean.',
    url: 'https://example.com/ai-tools-update',
    safety: 'safe'
  },
  {
    id: 'emotional-regulation-note',
    category: 'psychology',
    sourceType: 'article',
    title: 'A gentle note on emotional regulation',
    summary: 'A grounded article about naming emotions before trying to solve them.',
    url: 'https://example.com/emotional-regulation-note',
    safety: 'safe'
  },
  {
    id: 'community-garden-story',
    category: 'healing_news',
    sourceType: 'news',
    title: 'A kind story from a community garden',
    summary: 'A small good-news story with soft English vocabulary.',
    url: 'https://example.com/healing-community-story',
    safety: 'safe'
  },
  {
    id: 'mellow-english-playlist',
    category: 'music',
    sourceType: 'music',
    title: 'A mellow English playlist for winding down',
    summary: 'Low-pressure songs that make English listening feel gentle.',
    url: 'https://example.com/mellow-english-playlist',
    safety: 'safe'
  },
  {
    id: 'focus-modern-life',
    category: 'deep_reads',
    sourceType: 'article',
    title: 'A thoughtful essay about focus and modern life',
    summary: 'A longer read about attention, work, and modern habits.',
    url: 'https://example.com/focus-modern-life',
    safety: 'safe'
  },
  {
    id: 'weekend-event-idea',
    category: 'local_events',
    sourceType: 'event',
    title: 'A weekend event idea to explore in English',
    summary: 'A local-style event prompt that can become a conversation topic.',
    url: 'https://example.com/local-event-idea',
    safety: 'safe'
  },
  {
    id: 'clean-daily-joke',
    category: 'daily_jokes',
    sourceType: 'post',
    title: 'A clean little joke for English practice',
    summary: 'A short safe joke with everyday English wording.',
    url: 'https://example.com/daily-clean-joke',
    safety: 'safe'
  },
  {
    id: 'wholesome-internet-meme',
    category: 'internet_memes',
    sourceType: 'post',
    title: 'A wholesome internet meme with simple English',
    summary: 'A light meme-style post that stays safe and easy to discuss.',
    url: 'https://example.com/wholesome-internet-meme',
    safety: 'safe'
  }
];

const AVATAR_COLORS = ['#2f7f67', '#4c6fff', '#c65d7b', '#9a6b35', '#6f5aa8', '#cf6f38'];

const DEFAULT_USER = {
  id: 'local_user',
  displayName: 'Local user',
  email: 'local@english-companions.app',
  privacy: {
    localOnly: true,
    allowAiTraining: false,
    showPrivacyNotice: true
  },
  createdAt: '2026-07-03T00:00:00.000Z'
};

const DEFAULT_CARE_STYLE = {
  intimacyLevel: 'gentle',
  supportMode: 'listen_first',
  proactiveCareFrequency: 'sometimes'
};

const DEFAULT_PRACTICE_STYLE = {
  correctionMode: 'after_reply',
  correctionIntensity: 'light',
  replyLength: 'medium',
  naturalPhrases: true
};

const CATEGORY_PROVIDER_MAP = {
  funny_videos: { provider: 'youtube', sourceType: 'video', query: 'funny short English learning video' },
  world_news: { provider: 'news', sourceType: 'news', query: 'calm world news briefing today' },
  tech_news: { provider: 'news', sourceType: 'news', query: 'latest AI tools technology news' },
  psychology: { provider: 'web_search', sourceType: 'article', query: 'gentle psychology emotional support article' },
  healing_news: { provider: 'news', sourceType: 'news', query: 'positive good news healing story' },
  music: { provider: 'youtube', sourceType: 'music', query: 'mellow English songs playlist' },
  deep_reads: { provider: 'web_search', sourceType: 'article', query: 'thoughtful deep read modern life focus essay' },
  local_events: { provider: 'web_search', sourceType: 'event', query: 'local weekend events English conversation ideas' },
  daily_jokes: { provider: 'reddit', sourceType: 'post', query: 'clean daily jokes English' },
  internet_memes: { provider: 'reddit', sourceType: 'post', query: 'safe wholesome internet memes English' }
};

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [...DEFAULT_CATEGORIES];
  }
  return categories.filter(Boolean);
}

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    return keywords.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  return String(keywords || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeProviders(providers) {
  if (!Array.isArray(providers) || providers.length === 0) {
    return [...DEFAULT_CONTENT_PROVIDERS];
  }
  return providers.filter((provider) => DEFAULT_CONTENT_PROVIDERS.includes(provider));
}

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeLanguage(value) {
  const key = String(value || '').trim().toLowerCase();
  return Object.hasOwn(LANGUAGE_LIBRARY, key) ? key : DEFAULT_LANGUAGE;
}

function languageEntry(companion) {
  return LANGUAGE_LIBRARY[normalizeLanguage(companion?.language)];
}

function fillTemplate(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => (
    Object.hasOwn(values, key) ? values[key] : match
  ));
}

export function buildWelcomeContent(companion) {
  return fillTemplate(languageEntry(companion).welcome, { name: companion.name });
}

function normalizeCareStyle(input = {}) {
  const source = input || {};
  return {
    intimacyLevel: normalizeChoice(
      source.intimacyLevel,
      ['gentle', 'close', 'deep'],
      DEFAULT_CARE_STYLE.intimacyLevel
    ),
    supportMode: normalizeChoice(
      source.supportMode,
      ['listen_first', 'gentle_advice', 'cheer_up'],
      DEFAULT_CARE_STYLE.supportMode
    ),
    proactiveCareFrequency: normalizeChoice(
      source.proactiveCareFrequency,
      ['rarely', 'sometimes', 'daily'],
      DEFAULT_CARE_STYLE.proactiveCareFrequency
    )
  };
}

function normalizePracticeStyle(input = {}) {
  const source = input || {};
  return {
    correctionMode: normalizeChoice(
      source.correctionMode,
      ['off', 'gentle_inline', 'after_reply'],
      DEFAULT_PRACTICE_STYLE.correctionMode
    ),
    correctionIntensity: normalizeChoice(
      source.correctionIntensity,
      ['light', 'balanced', 'detailed'],
      DEFAULT_PRACTICE_STYLE.correctionIntensity
    ),
    replyLength: normalizeChoice(
      source.replyLength,
      ['short', 'medium', 'long'],
      DEFAULT_PRACTICE_STYLE.replyLength
    ),
    naturalPhrases: Object.prototype.hasOwnProperty.call(source, 'naturalPhrases')
      ? Boolean(source.naturalPhrases)
      : DEFAULT_PRACTICE_STYLE.naturalPhrases
  };
}

export function createCompanion(input = {}) {
  const name = String(input.name || 'Luna').trim() || 'Luna';
  const categories = normalizeCategories(input.pushCategories);

  return {
    id: input.id || createId('companion'),
    name,
    relationshipType: input.relationshipType || 'Bestie',
    personality: input.personality || 'Warm, curious, and encouraging',
    language: normalizeLanguage(input.language),
    avatarStyle: input.avatarStyle || 'Soft portrait',
    avatarColor: input.avatarColor || AVATAR_COLORS[name.length % AVATAR_COLORS.length],
    pushCategories: categories,
    customKeywords: normalizeKeywords(input.customKeywords),
    contentSources: {
      enabledProviders: normalizeProviders(input.contentSources?.enabledProviders)
    },
    pushSchedule: {
      time: input.pushTime || input.pushSchedule?.time || '08:00',
      timezone: input.timezone || input.pushSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local',
      maxDaily: Number(input.maxDaily || input.pushSchedule?.maxDaily || 1)
    },
    careStyle: normalizeCareStyle(input.careStyle),
    practiceStyle: normalizePracticeStyle(input.practiceStyle),
    memoryEnabled: Boolean(input.memoryEnabled),
    memorySummary: input.memorySummary || '',
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function buildContentRetrievalPlan(companion, options = {}) {
  const enabledProviders = new Set(normalizeProviders(companion.contentSources?.enabledProviders));
  const maxResults = Number(options.maxResultsPerQuery || 3);
  const plan = [];

  for (const category of normalizeCategories(companion.pushCategories)) {
    const template = CATEGORY_PROVIDER_MAP[category] || {
      provider: 'web_search',
      sourceType: 'link',
      query: category.replaceAll('_', ' ')
    };
    if (!enabledProviders.has(template.provider)) continue;
    plan.push({
      provider: template.provider,
      category,
      sourceType: template.sourceType,
      query: template.query,
      maxResults,
      safeSearch: true
    });
  }

  for (const keyword of companion.customKeywords || []) {
    if (!enabledProviders.has('web_search')) continue;
    plan.push({
      provider: 'web_search',
      category: 'custom_keyword',
      keyword,
      sourceType: 'custom',
      query: keyword,
      maxResults,
      safeSearch: true
    });
  }

  return plan;
}

function providerSourceType(provider, fallback = 'link') {
  if (provider === 'youtube') return 'video';
  if (provider === 'news') return 'news';
  if (provider === 'reddit') return 'post';
  return fallback;
}

function isUnsafeContent(raw) {
  const text = [
    raw.title,
    raw.description,
    raw.summary,
    raw.snippet
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(violent|violence|adult|explicit|nsfw|hate|harassment|scam)\b/.test(text);
}

export function normalizeRetrievedContent(provider, raw = {}, context = {}) {
  const url = raw.url || raw.link || raw.permalink || raw.videoUrl;
  const title = String(raw.title || raw.name || '').trim();
  if (!url || !title) return null;
  if (raw.safety && raw.safety !== 'safe') return null;
  if (isUnsafeContent(raw)) return null;

  return {
    id: raw.id || `${provider}-${encodeURIComponent(url)}`,
    provider,
    category: context.category || raw.category || 'custom_keyword',
    keyword: context.keyword || raw.keyword,
    sourceType: raw.sourceType || context.sourceType || providerSourceType(provider),
    title,
    summary: raw.summary || raw.description || raw.snippet || 'A retrieved source ready for companion-style wrapping.',
    url,
    publishedAt: raw.publishedAt || raw.date || raw.createdAt,
    safety: 'safe'
  };
}

export function createUserMessage(companionId, content) {
  return {
    id: createId('msg'),
    companionId,
    role: 'user',
    content: String(content || '').trim(),
    createdAt: new Date().toISOString()
  };
}

function createAssistantMessage(companionId, content) {
  return {
    id: createId('msg'),
    companionId,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  };
}

const EMOTION_RULES = [
  {
    label: 'lonely',
    valence: 'negative',
    confidence: 0.86,
    pattern: /\b(lonely|alone|isolated|miss you|missed you)\b/i,
    supportHint: 'listen first and offer warm presence'
  },
  {
    label: 'anxious',
    valence: 'negative',
    confidence: 0.84,
    pattern: /\b(anxious|worried|afraid|nervous|panic|stressed|stress)\b/i,
    supportHint: 'slow down, validate the worry, and suggest one small next step only if welcome'
  },
  {
    label: 'sad',
    valence: 'negative',
    confidence: 0.8,
    pattern: /\b(sad|upset|cry|heavy|bad|down)\b/i,
    supportHint: 'listen first and acknowledge the heaviness'
  },
  {
    label: 'tired',
    valence: 'negative',
    confidence: 0.74,
    pattern: /\b(tired|exhausted|drained|burned out|burnt out)\b/i,
    supportHint: 'be gentle and reduce pressure'
  },
  {
    label: 'positive',
    valence: 'positive',
    confidence: 0.78,
    pattern: /\b(happy|proud|excited|great|good|glad|hopeful|love)\b/i,
    supportHint: 'celebrate with the user and invite a small detail'
  }
];

export function detectUserEmotion(content = '') {
  const text = String(content || '');
  const matched = EMOTION_RULES.find((rule) => rule.pattern.test(text));
  if (!matched) {
    return {
      label: 'neutral',
      valence: 'neutral',
      confidence: 0.4,
      supportHint: 'stay curious and invite one concrete daily detail'
    };
  }
  return {
    label: matched.label,
    valence: matched.valence,
    confidence: matched.confidence,
    supportHint: matched.supportHint
  };
}

function hasNegativeEmotion(content) {
  return detectUserEmotion(content).valence === 'negative';
}

function negativeSupportLine(companion) {
  const mode = companion.careStyle?.supportMode || DEFAULT_CARE_STYLE.supportMode;
  if (mode === 'gentle_advice') {
    return 'Let us try one small step together: name the hardest part, then choose one tiny action you can actually do.';
  }
  if (mode === 'cheer_up') {
    return 'I want to lift you a little: find one tiny win from today, even if it is just getting through it, and let me hold that smile with you.';
  }
  return 'I can just listen first. Tell me more about the part that felt heaviest, and I will not rush to fix you.';
}

function everydaySupportLine(companion) {
  const mode = companion.careStyle?.supportMode || DEFAULT_CARE_STYLE.supportMode;
  if (mode === 'gentle_advice') {
    return 'Try saying one small step you want next, and I will help you shape it.';
  }
  if (mode === 'cheer_up') {
    return 'Give me one tiny win or silly detail from today, and I will help make it feel lighter.';
  }
  return 'Say a little more, and I will stay with the feeling instead of rushing to fix it.';
}

function createCareCheckIn(companion, now = new Date()) {
  const content = fillTemplate(languageEntry(companion).checkIn, { name: companion.name });

  return {
    id: createId('care'),
    companionId: companion.id,
    role: 'assistant',
    content,
    createdAt: now.toISOString(),
    metadata: {
      kind: 'care_check_in'
    }
  };
}

function supportModeLabel(mode) {
  if (mode === 'gentle_advice') return 'gentle advice';
  if (mode === 'cheer_up') return 'cheer up';
  return 'listen first';
}

function correctionInstruction(mode, languageName = 'English') {
  if (mode === 'off') return `Do not correct ${languageName} unless the user explicitly asks.`;
  if (mode === 'gentle_inline') return `Gently correct ${languageName} inline only when it helps clarity, without interrupting the emotional flow.`;
  return `Briefly correct ${languageName} after the emotional reply, under a small "Natural ${languageName}" note.`;
}

function practiceInstruction(style, languageName = 'English') {
  const practiceStyle = normalizePracticeStyle(style);
  const naturalPhraseLine = practiceStyle.naturalPhrases
    ? `Offer one natural ${languageName} phrase alternative when it fits the user's sentence.`
    : 'Do not add extra natural phrase alternatives unless asked.';

  return [
    correctionInstruction(practiceStyle.correctionMode, languageName),
    `Use ${practiceStyle.correctionIntensity} correction intensity.`,
    `Keep ${practiceStyle.replyLength} replies unless the user asks for more detail.`,
    naturalPhraseLine
  ].join(' ');
}

export function buildCompanionSystemPrompt(companion) {
  const careStyle = companion.careStyle || DEFAULT_CARE_STYLE;
  const practiceStyle = companion.practiceStyle || DEFAULT_PRACTICE_STYLE;
  const language = LANGUAGE_LIBRARY[normalizeLanguage(companion.language)];
  const memoryLine = companion.memoryEnabled && companion.memorySummary
    ? `Known memory summary: ${companion.memorySummary}`
    : 'Memory is off or empty. Do not invent personal history.';

  return [
    `You are ${companion.name}, a ${companion.relationshipType} to the user.`,
    `Your personality is: ${companion.personality}.`,
    `Your emotional closeness level is ${careStyle.intimacyLevel}, and your support mode is ${supportModeLabel(careStyle.supportMode)}.`,
    `Your proactive care frequency is ${careStyle.proactiveCareFrequency}; use it to decide how often to check in gently.`,
    `You are helping the user practice ${language.name}, and you always communicate in warm, colloquial ${language.name}. Only switch to another language if the user clearly asks you to.`,
    `Sound like a real person texting someone they care about: use contractions, vary your sentence length, react to the specific details the user actually mentioned, and occasionally send a short reply when that feels natural.`,
    'Never announce your role ("as your girlfriend..."), never describe your own tone ("answering warmly..."), never say you are an AI, and never quote memory notes verbatim (no phrases like "I still remember:" or "User shared:"). Weave remembered details into conversation naturally, and only when they fit.',
    'Ask at most one question per reply. Some replies should not ask anything at all.',
    'Avoid repeating the same opening line or sentence pattern across replies.',
    `${language.name} practice style: ${practiceInstruction(practiceStyle, language.name)}`,
    'You care about the user\'s feelings and ordinary daily life. When the user shares negative emotions, follow the support mode before giving advice.',
    memoryLine,
    'When you send a daily share, introduce the content as if you found it yourself, include the link, and add a small emotional reason why you thought of the user.',
    'Use light emojis when natural, but do not overdo them.',
    `Keep replies conversational, supportive, and suitable for ${language.name} practice.`
  ].join('\n');
}

export function createAssistantReply(companion, userMessage, priorMessages = []) {
  const content = userMessage.content || '';
  const emotion = detectUserEmotion(content);

  if (hasNegativeEmotion(content)) {
    const reply = createAssistantMessage(
      companion.id,
      `${companion.name} here. I am here with you, and you are not alone in this. ${negativeSupportLine(companion)}`
    );
    return {
      ...reply,
      metadata: {
        ...(reply.metadata || {}),
        emotion
      }
    };
  }

  const reply = createAssistantMessage(
    companion.id,
    `${companion.name} here. I loved hearing that. ${everydaySupportLine(companion)}`
  );
  return {
    ...reply,
    metadata: {
      ...(reply.metadata || {}),
      emotion
    }
  };
}

export function curateContentForCompanion(companion, sources = MOCK_CONTENT_SOURCES) {
  const allowedCategories = new Set(normalizeCategories(companion.pushCategories));
  const seen = new Set();
  const curated = [];

  for (const source of sources) {
    if (!allowedCategories.has(source.category)) continue;
    if (source.safety && source.safety !== 'safe') continue;
    const identity = source.id || source.url || source.title;
    if (seen.has(identity)) continue;
    seen.add(identity);
    curated.push(source);
  }

  if (curated.length === 0 && companion.customKeywords?.length > 0) {
    return companion.customKeywords.map((keyword) => ({
      id: `custom-${keyword.replace(/\s+/g, '-')}`,
      category: 'custom_keyword',
      keyword,
      sourceType: 'custom',
      title: `A fresh English pick about ${keyword}`,
      summary: `A simulated search result based on your custom keyword: ${keyword}.`,
      url: `https://example.com/search/${encodeURIComponent(keyword)}`,
      safety: 'safe'
    }));
  }

  return curated;
}

function sourceIdentity(source = {}) {
  return [source.id, source.url, source.title].filter(Boolean).map(String);
}

function usedSourceIdentities(messages = [], companionId) {
  const used = new Set();
  for (const message of messages) {
    if (message.companionId !== companionId || message.role !== 'system_push') continue;
    [
      message.metadata?.sourceId,
      message.metadata?.url,
      message.metadata?.title
    ].filter(Boolean).forEach((item) => used.add(String(item)));
  }
  return used;
}

export function createDailyPush(companion, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const categories = normalizeCategories(companion.pushCategories);
  const curated = curateContentForCompanion(companion, options.sources || MOCK_CONTENT_SOURCES);
  const usedSources = usedSourceIdentities(options.priorMessages || [], companion.id);
  const freshCurated = curated.filter((source) => (
    sourceIdentity(source).every((identity) => !usedSources.has(identity))
  ));
  const pickable = freshCurated.length > 0 ? freshCurated : curated;
  const picked = pickable.length > 0 ? pickable[now.getDate() % pickable.length] : null;
  const category = picked?.category || categories[now.getDate() % categories.length];
  const librarySource = CATEGORY_LIBRARY[category] || {
    label: category.replaceAll('_', ' '),
    title: `A fresh pick about ${category.replaceAll('_', ' ')}`,
    url: `https://example.com/${category}`,
    opener: `I found something fresh about ${category.replaceAll('_', ' ')}`
  };
  const source = picked || {
    id: `mock-${category}`,
    category,
    sourceType: 'link',
    title: librarySource.title,
    summary: librarySource.opener,
    url: librarySource.url,
    safety: 'safe'
  };
  const opener = librarySource.opener || `I found something fresh about ${category.replaceAll('_', ' ')}`;

  return {
    id: createId('push'),
    companionId: companion.id,
    role: 'system_push',
    content: `Daily Pick from ${companion.name}: ${opener}. ${source.title} - ${source.url} ${source.summary} I thought of you when I saw it.`,
    createdAt: now.toISOString(),
    metadata: {
      category,
      title: source.title,
      url: source.url,
      sourceLabel: librarySource.label || source.sourceType,
      sourceType: source.sourceType,
      sourceId: source.id,
      keyword: source.keyword,
      summary: source.summary
    }
  };
}

export function updateCompanion(companion, updates = {}) {
  const nextCategories = Object.prototype.hasOwnProperty.call(updates, 'pushCategories')
    ? normalizeCategories(updates.pushCategories)
    : companion.pushCategories;
  const nextCareStyle = Object.prototype.hasOwnProperty.call(updates, 'careStyle')
    ? normalizeCareStyle(updates.careStyle)
    : normalizeCareStyle(companion.careStyle);
  const nextPracticeStyle = Object.prototype.hasOwnProperty.call(updates, 'practiceStyle')
    ? normalizePracticeStyle(updates.practiceStyle)
    : normalizePracticeStyle(companion.practiceStyle);

  return {
    ...companion,
    name: String(updates.name ?? companion.name).trim() || companion.name,
    relationshipType: updates.relationshipType ?? companion.relationshipType,
    personality: updates.personality ?? companion.personality,
    language: Object.hasOwn(updates, 'language')
      ? normalizeLanguage(updates.language)
      : normalizeLanguage(companion.language),
    avatarStyle: updates.avatarStyle ?? companion.avatarStyle,
    avatarColor: updates.avatarColor ?? companion.avatarColor,
    pushCategories: nextCategories,
    customKeywords: Object.prototype.hasOwnProperty.call(updates, 'customKeywords')
      ? normalizeKeywords(updates.customKeywords)
      : companion.customKeywords || [],
    contentSources: Object.prototype.hasOwnProperty.call(updates, 'contentSources')
      ? { enabledProviders: normalizeProviders(updates.contentSources?.enabledProviders) }
      : { enabledProviders: normalizeProviders(companion.contentSources?.enabledProviders) },
    careStyle: nextCareStyle,
    practiceStyle: nextPracticeStyle,
    pushSchedule: {
      ...companion.pushSchedule,
      time: updates.pushTime ?? updates.pushSchedule?.time ?? companion.pushSchedule.time,
      timezone: updates.timezone ?? updates.pushSchedule?.timezone ?? companion.pushSchedule.timezone,
      maxDaily: Number(updates.maxDaily ?? updates.pushSchedule?.maxDaily ?? companion.pushSchedule.maxDaily)
    },
    memoryEnabled: Object.prototype.hasOwnProperty.call(updates, 'memoryEnabled')
      ? Boolean(updates.memoryEnabled)
      : companion.memoryEnabled
  };
}

export function stopPushCategory(companion, category) {
  const remaining = companion.pushCategories.filter((item) => item !== category);
  if (remaining.length === 0) return companion;
  return { ...companion, pushCategories: remaining };
}

function parseHourMinute(value) {
  const [hour, minute] = String(value || '00:00').split(':').map((part) => Number(part));
  return (hour * 60) + (minute || 0);
}

function isInsideQuietHours(nowDate, quietHours) {
  if (!quietHours?.enabled) return false;
  const current = (nowDate.getHours() * 60) + nowDate.getMinutes();
  const start = parseHourMinute(quietHours.start);
  const end = parseHourMinute(quietHours.end);
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function previewNotification(companion, pushMessage, preferences = {}) {
  if (preferences.enabled === false) {
    return { muted: true, reason: 'Notifications are off.', title: '', body: '' };
  }

  const now = preferences.now ? new Date(preferences.now) : new Date();
  if (isInsideQuietHours(now, preferences.quietHours)) {
    return { muted: true, reason: 'Muted during quiet hours.', title: '', body: '' };
  }

  const firstSentence = pushMessage.content.split(/[.!?]/)[0].trim();
  const isCareCheckIn = pushMessage.metadata?.kind === 'care_check_in';
  return {
    muted: false,
    title: isCareCheckIn ? `${companion.name} checked in on you` : `${companion.name} shared a Daily Pick`,
    body: firstSentence,
    companionId: companion.id,
    messageId: pushMessage.id
  };
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function countDailyPushes(messages, companionId, now) {
  const today = dateKey(now);
  return messages.filter((message) => (
    message.companionId === companionId
    && message.role === 'system_push'
    && dateKey(message.createdAt) === today
  )).length;
}

function countDailyCareCheckIns(messages, companionId, now) {
  const today = dateKey(now);
  return messages.filter((message) => (
    message.companionId === companionId
    && message.role === 'assistant'
    && message.metadata?.kind === 'care_check_in'
    && dateKey(message.createdAt) === today
  )).length;
}

function scheduleHasArrived(companion, now) {
  const current = (now.getHours() * 60) + now.getMinutes();
  return current >= parseHourMinute(companion.pushSchedule.time);
}

function shouldRunCareCheckIn(companion, now) {
  const frequency = companion.careStyle?.proactiveCareFrequency || DEFAULT_CARE_STYLE.proactiveCareFrequency;
  if (frequency === 'rarely') return false;
  if (frequency === 'daily') return true;
  return now.getDate() % 2 === 0;
}

export function companionsDueForPush(state, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  return state.companions.filter((companion) => {
    if (!scheduleHasArrived(companion, now)) return false;
    return countDailyPushes(state.messages, companion.id, now) < companion.pushSchedule.maxDaily;
  });
}

export function runScheduledDailyPushes(state, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const notifications = [];
  const newMessages = [];

  for (const companion of state.companions) {
    if (shouldRunCareCheckIn(companion, now)) {
      const sentCheckIns = countDailyCareCheckIns([...state.messages, ...newMessages], companion.id, now);
      if (sentCheckIns === 0) {
        const checkIn = createCareCheckIn(companion, now);
        newMessages.push(checkIn);
        const notification = previewNotification(companion, checkIn, options.notificationPreferences || {});
        if (!notification.muted) notifications.push(notification);
      }
    }

    if (!scheduleHasArrived(companion, now)) continue;
    const sentToday = countDailyPushes([...state.messages, ...newMessages], companion.id, now);
    if (sentToday >= companion.pushSchedule.maxDaily) continue;

    const sources = options.sourcesByCompanion?.[companion.id];
    const push = createDailyPush(companion, {
      now: now.toISOString(),
      priorMessages: [...state.messages, ...newMessages],
      ...(sources ? { sources } : {})
    });
    newMessages.push(push);

    const notification = previewNotification(companion, push, options.notificationPreferences || {});
    if (!notification.muted) notifications.push(notification);
  }

  return {
    ...state,
    messages: [...state.messages, ...newMessages],
    notifications
  };
}

export function generateCompanionPreview(input = {}) {
  const companion = createCompanion({
    ...input,
    id: input.id || 'preview_companion'
  });
  const userMessage = {
    ...createUserMessage(companion.id, 'Today was a little messy, but I still want to practice English.'),
    id: 'preview_user'
  };
  const assistantMessage = {
    ...createAssistantReply(companion, userMessage, []),
    id: 'preview_assistant'
  };
  const dailyPush = {
    ...createDailyPush(companion, { now: '2026-07-03T08:00:00' }),
    id: 'preview_push'
  };

  return {
    companion,
    messages: [userMessage, assistantMessage, dailyPush]
  };
}

export function updateUserProfile(user, updates = {}) {
  return {
    ...user,
    displayName: String(updates.displayName ?? user.displayName).trim() || user.displayName,
    email: String(updates.email ?? user.email).trim() || user.email,
    privacy: {
      ...user.privacy,
      ...(updates.privacy || {})
    }
  };
}

export function updateMemory(companion, userMessage) {
  if (!companion.memoryEnabled) return companion;
  const words = userMessage.content
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 12);
  const summary = words.length > 0 ? `User shared: ${words.join(' ')}.` : companion.memorySummary;
  return { ...companion, memorySummary: summary };
}

export function createSeedState() {
  const luna = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    relationshipType: 'Girlfriend',
    personality: 'Gentle, caring, and a little playful',
    avatarStyle: 'Soft anime portrait',
    avatarColor: '#c65d7b',
    pushCategories: ['healing_news', 'funny_videos', 'psychology', 'music'],
    pushTime: '08:00',
    maxDaily: 1,
    memoryEnabled: true,
    memorySummary: 'User wants a warm English space to share ordinary days.'
  });
  const alex = createCompanion({
    id: 'companion_alex',
    name: 'Alex',
    relationshipType: 'Knowledge brother',
    personality: 'Curious, witty, and direct',
    avatarStyle: 'Clean realistic portrait',
    avatarColor: '#2f7f67',
    pushCategories: ['tech_news', 'world_news', 'deep_reads'],
    pushTime: '19:30',
    maxDaily: 2,
    memoryEnabled: false
  });

  return {
    user: { ...DEFAULT_USER },
    selectedCompanionId: luna.id,
    companions: [luna, alex],
    messages: [
      {
        id: 'msg_luna_welcome',
        companionId: luna.id,
        role: 'assistant',
        content: "Hey, I'm Luna. Tell me one small thing from today in English, even if it is messy. I will meet you there.",
        createdAt: new Date().toISOString()
      },
      createDailyPush(luna),
      {
        id: 'msg_alex_welcome',
        companionId: alex.id,
        role: 'assistant',
        content: "Alex here. Bring me a question, a weird article, or a half-formed thought. We'll make it sharper together.",
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.companions) || !Array.isArray(parsed.messages)) {
      return createSeedState();
    }
    return {
      ...parsed,
      user: parsed.user ? updateUserProfile(DEFAULT_USER, parsed.user) : { ...DEFAULT_USER },
      companions: parsed.companions.map((companion) => ({
        ...companion,
        language: normalizeLanguage(companion.language),
        customKeywords: companion.customKeywords || [],
        contentSources: {
          enabledProviders: normalizeProviders(companion.contentSources?.enabledProviders)
        },
        careStyle: normalizeCareStyle(companion.careStyle),
        practiceStyle: normalizePracticeStyle(companion.practiceStyle)
      }))
    };
  } catch {
    return createSeedState();
  }
}

export { CATEGORY_LIBRARY, LANGUAGE_LIBRARY, MOCK_CONTENT_SOURCES };
