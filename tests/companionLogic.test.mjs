import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentRetrievalPlan,
  buildCompanionSystemPrompt,
  CATEGORY_LIBRARY,
  createAssistantReply,
  createCompanion,
  createDailyPush,
  createSeedState,
  createUserMessage,
  curateContentForCompanion,
  detectUserEmotion,
  deserializeState,
  generateCompanionPreview,
  normalizeRetrievedContent,
  previewNotification,
  runScheduledDailyPushes,
  serializeState,
  stopPushCategory,
  updateCompanion,
  updateUserProfile,
  updateMemory
} from '../src/companionLogic.js';

test('seed state includes multiple companions with independent messages', () => {
  const state = createSeedState();

  assert.equal(state.user.email, 'local@english-companions.app');
  assert.equal(state.user.privacy.allowAiTraining, false);
  assert.equal(state.companions.length, 2);
  assert.ok(state.selectedCompanionId);
  assert.ok(state.messages.every((message) => message.companionId));
  assert.notEqual(state.companions[0].id, state.companions[1].id);
});

test('creates a companion with relationship, tone, schedule, memory, and push categories', () => {
  const companion = createCompanion({
    name: 'Mia',
    relationshipType: 'Girlfriend',
    personality: 'Warm and playful',
    pushCategories: ['funny_videos', 'psychology'],
    customKeywords: ['cooking', 'travel'],
    pushTime: '08:30',
    maxDaily: 3,
    memoryEnabled: true,
    avatarStyle: 'Anime'
  });

  assert.equal(companion.name, 'Mia');
  assert.equal(companion.relationshipType, 'Girlfriend');
  assert.deepEqual(companion.pushCategories, ['funny_videos', 'psychology']);
  assert.deepEqual(companion.customKeywords, ['cooking', 'travel']);
  assert.equal(companion.pushSchedule.time, '08:30');
  assert.equal(companion.pushSchedule.maxDaily, 3);
  assert.equal(companion.memoryEnabled, true);
  assert.equal(companion.avatarStyle, 'Anime');
});

test('creates a companion with enabled content source providers', () => {
  const companion = createCompanion({
    name: 'Mia',
    pushCategories: ['funny_videos', 'world_news'],
    contentSources: {
      enabledProviders: ['youtube', 'news']
    }
  });

  assert.deepEqual(companion.contentSources.enabledProviders, ['youtube', 'news']);
});

test('creates a companion with emotional care style settings', () => {
  const companion = createCompanion({
    name: 'Mia',
    relationshipType: 'Girlfriend',
    careStyle: {
      intimacyLevel: 'close',
      supportMode: 'listen_first',
      proactiveCareFrequency: 'daily'
    }
  });

  assert.deepEqual(companion.careStyle, {
    intimacyLevel: 'close',
    supportMode: 'listen_first',
    proactiveCareFrequency: 'daily'
  });
});

test('creates a companion with English practice style settings', () => {
  const companion = createCompanion({
    name: 'Mia',
    practiceStyle: {
      correctionMode: 'gentle_inline',
      correctionIntensity: 'light',
      replyLength: 'short',
      naturalPhrases: true
    }
  });

  assert.deepEqual(companion.practiceStyle, {
    correctionMode: 'gentle_inline',
    correctionIntensity: 'light',
    replyLength: 'short',
    naturalPhrases: true
  });
});

test('builds a provider retrieval plan from categories and custom keywords', () => {
  const companion = createCompanion({
    name: 'Luna',
    pushCategories: ['funny_videos', 'world_news', 'psychology'],
    customKeywords: ['cooking'],
    contentSources: {
      enabledProviders: ['youtube', 'news', 'web_search']
    }
  });

  const plan = buildContentRetrievalPlan(companion, { maxResultsPerQuery: 4 });

  assert.deepEqual(plan.map((item) => item.provider), ['youtube', 'news', 'web_search', 'web_search']);
  assert.deepEqual(plan.map((item) => item.category), ['funny_videos', 'world_news', 'psychology', 'custom_keyword']);
  assert.equal(plan[0].maxResults, 4);
  assert.equal(plan[0].safeSearch, true);
  assert.match(plan[0].query, /funny|English/i);
  assert.match(plan[3].query, /cooking/);
});

test('category library exposes all creation-form content options from the product spec', () => {
  assert.equal(CATEGORY_LIBRARY.daily_jokes.label, 'Daily joke');
  assert.equal(CATEGORY_LIBRARY.internet_memes.label, 'Internet meme');
});

test('retrieval plan respects disabled source providers', () => {
  const companion = createCompanion({
    name: 'Alex',
    pushCategories: ['funny_videos', 'world_news'],
    contentSources: {
      enabledProviders: ['news']
    }
  });

  const plan = buildContentRetrievalPlan(companion);

  assert.deepEqual(plan.map((item) => item.provider), ['news']);
  assert.equal(plan[0].category, 'world_news');
});

test('normalizes retrieved provider results and blocks unsafe or incomplete content', () => {
  const safe = normalizeRetrievedContent('news', {
    id: 'n-1',
    title: 'A calm world update',
    description: 'A short briefing with context.',
    link: 'https://news.example.com/world',
    publishedAt: '2026-07-04T08:00:00Z'
  }, {
    category: 'world_news'
  });
  const missingUrl = normalizeRetrievedContent('youtube', {
    title: 'A funny English short'
  }, {
    category: 'funny_videos'
  });
  const unsafe = normalizeRetrievedContent('web_search', {
    title: 'Violent prank compilation',
    url: 'https://example.com/prank'
  }, {
    category: 'funny_videos'
  });

  assert.equal(safe.provider, 'news');
  assert.equal(safe.category, 'world_news');
  assert.equal(safe.sourceType, 'news');
  assert.equal(safe.safety, 'safe');
  assert.equal(missingUrl, null);
  assert.equal(unsafe, null);
});

test('assistant reply uses companion role and gives support for negative emotion', () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    personality: 'Gentle and caring',
    pushCategories: ['healing_news']
  });
  const userMessage = createUserMessage(companion.id, 'I feel sad and tired today.');

  const reply = createAssistantReply(companion, userMessage, []);

  assert.equal(reply.role, 'assistant');
  assert.equal(reply.companionId, companion.id);
  assert.match(reply.content, /Luna/);
  assert.match(reply.content, /I am here with you|not alone|gentle/i);
});

test('detects user emotion for companion care context', () => {
  const anxious = detectUserEmotion('I feel anxious and worried before my interview.');
  const happy = detectUserEmotion('I am proud and excited today.');
  const neutral = detectUserEmotion('I cooked dinner and practiced English.');

  assert.equal(anxious.label, 'anxious');
  assert.equal(anxious.valence, 'negative');
  assert.ok(anxious.confidence > 0.5);
  assert.equal(happy.label, 'positive');
  assert.equal(happy.valence, 'positive');
  assert.equal(neutral.label, 'neutral');
});

test('assistant replies include emotion metadata for the latest user message', () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    memoryEnabled: true
  });
  const userMessage = createUserMessage(companion.id, 'I feel lonely and tired tonight.');

  const reply = createAssistantReply(companion, userMessage, []);

  assert.equal(reply.metadata.emotion.label, 'lonely');
  assert.equal(reply.metadata.emotion.valence, 'negative');
  assert.ok(reply.metadata.emotion.supportHint.includes('listen'));
});

test('assistant reply changes emotional support wording by support mode', () => {
  const listenFirst = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    careStyle: { supportMode: 'listen_first' }
  });
  const gentleAdvice = createCompanion({
    name: 'Mia',
    relationshipType: 'Bestie',
    careStyle: { supportMode: 'gentle_advice' }
  });
  const cheerUp = createCompanion({
    name: 'Alex',
    relationshipType: 'Boyfriend',
    careStyle: { supportMode: 'cheer_up' }
  });
  const sadMessage = createUserMessage(listenFirst.id, 'I feel sad and tired today.');

  const listeningReply = createAssistantReply(listenFirst, sadMessage, []);
  const adviceReply = createAssistantReply(gentleAdvice, { ...sadMessage, companionId: gentleAdvice.id }, []);
  const cheerReply = createAssistantReply(cheerUp, { ...sadMessage, companionId: cheerUp.id }, []);

  assert.match(listeningReply.content, /just listen|tell me more/i);
  assert.match(adviceReply.content, /one small step|try/i);
  assert.match(cheerReply.content, /smile|tiny win|lift/i);
});

test('builds a companion system prompt from role, care style, memory, and daily share behavior', () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    personality: 'Gentle, caring, and playful',
    memoryEnabled: true,
    memorySummary: 'User has a pet named Mochi and worries about work.',
    careStyle: {
      intimacyLevel: 'close',
      supportMode: 'listen_first',
      proactiveCareFrequency: 'daily'
    },
    practiceStyle: {
      correctionMode: 'after_reply',
      correctionIntensity: 'balanced',
      replyLength: 'medium',
      naturalPhrases: true
    }
  });

  const prompt = buildCompanionSystemPrompt(companion);

  assert.match(prompt, /You are Luna/);
  assert.match(prompt, /Girlfriend/);
  assert.match(prompt, /Gentle, caring, and playful/);
  assert.match(prompt, /close/i);
  assert.match(prompt, /listen first/i);
  assert.match(prompt, /Mochi/);
  assert.match(prompt, /always communicate in warm, colloquial English/i);
  assert.match(prompt, /correct English after the emotional reply/i);
  assert.match(prompt, /balanced correction/i);
  assert.match(prompt, /medium replies/i);
  assert.match(prompt, /natural phrase/i);
  assert.match(prompt, /daily share/i);
  assert.match(prompt, /light emojis/i);
});

test('daily push uses configured categories and includes a link metadata payload', () => {
  const companion = createCompanion({
    name: 'Alex',
    relationshipType: 'Mentor',
    personality: 'Curious and witty',
    pushCategories: ['tech_news', 'deep_reads']
  });

  const push = createDailyPush(companion);

  assert.equal(push.role, 'system_push');
  assert.equal(push.companionId, companion.id);
  assert.ok(companion.pushCategories.includes(push.metadata.category));
  assert.match(push.content, /Daily Pick/);
  assert.match(push.metadata.url, /^https:\/\//);
});

test('daily push supports daily jokes and internet meme categories', () => {
  const jokeCompanion = createCompanion({
    name: 'Mia',
    pushCategories: ['daily_jokes']
  });
  const memeCompanion = createCompanion({
    name: 'Alex',
    pushCategories: ['internet_memes']
  });

  const jokePush = createDailyPush(jokeCompanion, { now: '2026-07-05T08:00:00.000Z' });
  const memePush = createDailyPush(memeCompanion, { now: '2026-07-05T08:00:00.000Z' });

  assert.equal(jokePush.metadata.category, 'daily_jokes');
  assert.equal(jokePush.metadata.sourceType, 'post');
  assert.match(jokePush.content, /joke|laugh/i);
  assert.equal(memePush.metadata.category, 'internet_memes');
  assert.equal(memePush.metadata.sourceType, 'post');
  assert.match(memePush.content, /meme|internet/i);
});

test('memory summary updates from user messages when enabled', () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Bestie',
    personality: 'Encouraging',
    pushCategories: ['music'],
    memoryEnabled: true
  });
  const userMessage = createUserMessage(companion.id, 'My cat Mochi made me laugh after work.');

  const updated = updateMemory(companion, userMessage);

  assert.match(updated.memorySummary, /Mochi/);
  assert.match(updated.memorySummary, /work/);
});

test('state serialization round-trips safely and falls back on invalid JSON', () => {
  const state = createSeedState();
  const serialized = serializeState(state);
  const restored = deserializeState(serialized);
  const fallback = deserializeState('{bad json');

  assert.deepEqual(restored.selectedCompanionId, state.selectedCompanionId);
  assert.equal(restored.companions.length, state.companions.length);
  assert.equal(fallback.companions.length, 2);
});

test('deserializes older local state by adding a default user profile', () => {
  const oldState = {
    selectedCompanionId: 'companion_luna',
    companions: [createCompanion({ id: 'companion_luna', name: 'Luna' })],
    messages: []
  };

  const restored = deserializeState(JSON.stringify(oldState));

  assert.equal(restored.user.email, 'local@english-companions.app');
  assert.equal(restored.user.privacy.allowAiTraining, false);
});

test('updates companion profile and push preferences without losing identity', () => {
  const companion = createCompanion({
    id: 'companion_mia',
    name: 'Mia',
    relationshipType: 'Bestie',
    personality: 'Warm',
    pushCategories: ['music'],
    pushTime: '08:00',
    maxDaily: 1,
    memoryEnabled: false,
    careStyle: {
      intimacyLevel: 'gentle',
      supportMode: 'listen_first',
      proactiveCareFrequency: 'weekly'
    },
    practiceStyle: {
      correctionMode: 'off',
      correctionIntensity: 'light',
      replyLength: 'short',
      naturalPhrases: false
    }
  });

  const updated = updateCompanion(companion, {
    name: 'Mia Chen',
    relationshipType: 'Girlfriend',
    personality: 'Warm, playful, and supportive',
    pushCategories: ['music', 'psychology'],
    pushTime: '21:15',
    maxDaily: 3,
    memoryEnabled: true,
    careStyle: {
      intimacyLevel: 'close',
      supportMode: 'gentle_advice',
      proactiveCareFrequency: 'daily'
    },
    practiceStyle: {
      correctionMode: 'after_reply',
      correctionIntensity: 'detailed',
      replyLength: 'long',
      naturalPhrases: true
    }
  });

  assert.equal(updated.id, 'companion_mia');
  assert.equal(updated.name, 'Mia Chen');
  assert.equal(updated.relationshipType, 'Girlfriend');
  assert.deepEqual(updated.pushCategories, ['music', 'psychology']);
  assert.equal(updated.pushSchedule.time, '21:15');
  assert.equal(updated.pushSchedule.maxDaily, 3);
  assert.equal(updated.memoryEnabled, true);
  assert.deepEqual(updated.careStyle, {
    intimacyLevel: 'close',
    supportMode: 'gentle_advice',
    proactiveCareFrequency: 'daily'
  });
  assert.deepEqual(updated.practiceStyle, {
    correctionMode: 'after_reply',
    correctionIntensity: 'detailed',
    replyLength: 'long',
    naturalPhrases: true
  });
});

test('stops a push category while keeping at least one category active', () => {
  const companion = createCompanion({
    name: 'Alex',
    pushCategories: ['tech_news', 'world_news']
  });

  const withoutTech = stopPushCategory(companion, 'tech_news');
  const stillHasOne = stopPushCategory(withoutTech, 'world_news');

  assert.deepEqual(withoutTech.pushCategories, ['world_news']);
  assert.deepEqual(stillHasOne.pushCategories, ['world_news']);
});

test('notification preview respects quiet hours', () => {
  const companion = createCompanion({
    name: 'Luna',
    pushCategories: ['healing_news']
  });
  const push = createDailyPush(companion);

  const allowed = previewNotification(companion, push, {
    enabled: true,
    quietHours: { enabled: true, start: '23:00', end: '07:00' },
    now: '2026-07-03T08:30:00'
  });
  const muted = previewNotification(companion, push, {
    enabled: true,
    quietHours: { enabled: true, start: '23:00', end: '07:00' },
    now: '2026-07-03T23:30:00'
  });

  assert.equal(allowed.muted, false);
  assert.match(allowed.title, /Luna/);
  assert.equal(muted.muted, true);
  assert.match(muted.reason, /quiet hours/i);
});

test('notification preview labels proactive care check-ins separately from Daily Picks', () => {
  const companion = createCompanion({
    name: 'Luna'
  });
  const checkIn = {
    id: 'care_1',
    companionId: companion.id,
    role: 'assistant',
    content: 'Luna here. How are you today, really?',
    createdAt: '2026-07-05T10:00:00.000Z',
    metadata: {
      kind: 'care_check_in'
    }
  };

  const notification = previewNotification(companion, checkIn, {
    enabled: true,
    now: '2026-07-05T10:00:00.000Z'
  });

  assert.equal(notification.title, 'Luna checked in on you');
  assert.equal(notification.messageId, 'care_1');
});

test('scheduled daily pushes run only after companion schedule time', () => {
  const state = {
    selectedCompanionId: 'companion_luna',
    companions: [
      createCompanion({
        id: 'companion_luna',
        name: 'Luna',
        pushCategories: ['healing_news'],
        pushTime: '08:00',
        maxDaily: 1
      })
    ],
    messages: []
  };

  const early = runScheduledDailyPushes(state, {
    now: '2026-07-03T07:30:00',
    notificationPreferences: { enabled: true }
  });
  const onTime = runScheduledDailyPushes(state, {
    now: '2026-07-03T08:05:00',
    notificationPreferences: { enabled: true }
  });

  assert.equal(early.messages.length, 0);
  assert.equal(early.notifications.length, 0);
  assert.equal(onTime.messages.length, 1);
  assert.equal(onTime.messages[0].role, 'system_push');
  assert.equal(onTime.notifications.length, 1);
  assert.match(onTime.notifications[0].title, /Luna/);
});

test('scheduled daily pushes respect maxDaily per companion per day', () => {
  const companion = createCompanion({
    id: 'companion_alex',
    name: 'Alex',
    pushCategories: ['tech_news'],
    pushTime: '08:00',
    maxDaily: 1
  });
  const existingPush = {
    ...createDailyPush(companion),
    createdAt: '2026-07-03T08:10:00'
  };
  const state = {
    selectedCompanionId: companion.id,
    companions: [companion],
    messages: [existingPush]
  };

  const result = runScheduledDailyPushes(state, {
    now: '2026-07-03T19:00:00',
    notificationPreferences: { enabled: true }
  });

  assert.equal(result.messages.length, 1);
  assert.equal(result.notifications.length, 0);
});

test('scheduled daily pushes can use companion-specific retrieved sources', () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    pushCategories: ['funny_videos'],
    pushTime: '08:00',
    maxDaily: 1
  });
  const state = {
    selectedCompanionId: companion.id,
    companions: [companion],
    messages: []
  };

  const result = runScheduledDailyPushes(state, {
    now: '2026-07-03T08:05:00',
    notificationPreferences: { enabled: true },
    sourcesByCompanion: {
      [companion.id]: [
        {
          id: 'live-video',
          category: 'funny_videos',
          sourceType: 'video',
          title: 'A live English comedy clip',
          summary: 'Retrieved from an external content source.',
          url: 'https://video.example.com/live',
          safety: 'safe'
        }
      ]
    }
  });

  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].metadata.sourceId, 'live-video');
  assert.match(result.messages[0].content, /A live English comedy clip/);
});

test('scheduled daily pushes avoid sources already sent to that companion', () => {
  const repeated = {
    id: 'live-repeat',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'Repeated clip',
    summary: 'Already sent.',
    url: 'https://example.com/repeated',
    safety: 'safe'
  };
  const fresh = {
    id: 'live-fresh',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'Fresh clip',
    summary: 'New for today.',
    url: 'https://example.com/fresh',
    safety: 'safe'
  };
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    pushCategories: ['funny_videos'],
    pushTime: '08:00'
  });
  const state = {
    companions: [companion],
    messages: [{
      id: 'old_push',
      companionId: companion.id,
      role: 'system_push',
      content: 'Old Daily Pick',
      createdAt: '2026-07-04T08:00:00.000Z',
      metadata: {
        sourceId: repeated.id,
        url: repeated.url
      }
    }]
  };

  const result = runScheduledDailyPushes(state, {
    now: '2026-07-06T09:00:00.000Z',
    sourcesByCompanion: {
      [companion.id]: [repeated, fresh]
    }
  });

  assert.equal(result.messages.at(-1).metadata.sourceId, fresh.id);
});

test('scheduled care check-ins follow proactive care frequency and avoid duplicate daily nudges', () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    relationshipType: 'Girlfriend',
    careStyle: {
      proactiveCareFrequency: 'daily',
      supportMode: 'listen_first',
      intimacyLevel: 'close'
    },
    pushTime: '23:00'
  });
  const rarely = createCompanion({
    id: 'companion_alex',
    name: 'Alex',
    careStyle: {
      proactiveCareFrequency: 'rarely'
    },
    pushTime: '23:00'
  });
  const state = {
    selectedCompanionId: companion.id,
    companions: [companion, rarely],
    messages: []
  };

  const firstRun = runScheduledDailyPushes(state, {
    now: '2026-07-05T10:00:00.000Z',
    notificationPreferences: { enabled: true }
  });
  const secondRun = runScheduledDailyPushes(firstRun, {
    now: '2026-07-05T11:00:00.000Z',
    notificationPreferences: { enabled: true }
  });

  const careMessages = firstRun.messages.filter((message) => message.role === 'assistant' && message.metadata?.kind === 'care_check_in');
  assert.equal(careMessages.length, 1);
  assert.equal(careMessages[0].companionId, companion.id);
  assert.match(careMessages[0].content, /Luna|today|how are you/i);
  assert.equal(firstRun.notifications.length, 1);
  assert.match(firstRun.notifications[0].title, /Luna/);
  assert.equal(secondRun.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
});

test('curates safe unique content from companion categories', () => {
  const companion = createCompanion({
    name: 'Mia',
    personality: 'Warm and playful',
    pushCategories: ['funny_videos', 'psychology']
  });
  const sources = [
    {
      id: 'duplicate',
      category: 'funny_videos',
      sourceType: 'video',
      title: 'A playful English skit',
      summary: 'A short sketch with useful daily phrases.',
      url: 'https://example.com/skit',
      safety: 'safe'
    },
    {
      id: 'duplicate',
      category: 'funny_videos',
      sourceType: 'video',
      title: 'Duplicate skit',
      summary: 'Same item.',
      url: 'https://example.com/skit-copy',
      safety: 'safe'
    },
    {
      id: 'unsafe',
      category: 'psychology',
      sourceType: 'article',
      title: 'Unsafe advice',
      summary: 'Not suitable.',
      url: 'https://example.com/unsafe',
      safety: 'blocked'
    }
  ];

  const curated = curateContentForCompanion(companion, sources);

  assert.equal(curated.length, 1);
  assert.equal(curated[0].id, 'duplicate');
  assert.equal(curated[0].sourceType, 'video');
});

test('daily push can wrap retrieved source content with metadata', () => {
  const companion = createCompanion({
    name: 'Mia',
    personality: 'Warm and playful',
    pushCategories: ['funny_videos']
  });
  const source = {
    id: 'skit-1',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'A playful English skit',
    summary: 'A short sketch with useful daily phrases.',
    url: 'https://example.com/skit',
    safety: 'safe'
  };

  const push = createDailyPush(companion, { sources: [source] });

  assert.equal(push.metadata.title, 'A playful English skit');
  assert.equal(push.metadata.sourceType, 'video');
  assert.equal(push.metadata.sourceId, 'skit-1');
  assert.match(push.content, /A playful English skit/);
  assert.match(push.content, /https:\/\/example.com\/skit/);
});

test('daily push avoids repeating sources already sent to the same companion', () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    pushCategories: ['funny_videos']
  });
  const repeated = {
    id: 'video-repeat',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'Already sent video',
    summary: 'This should not repeat.',
    url: 'https://example.com/repeated-video',
    safety: 'safe'
  };
  const fresh = {
    id: 'video-fresh',
    category: 'funny_videos',
    sourceType: 'video',
    title: 'Fresh video',
    summary: 'This one is new.',
    url: 'https://example.com/fresh-video',
    safety: 'safe'
  };
  const priorMessages = [{
    id: 'push_old',
    companionId: companion.id,
    role: 'system_push',
    content: 'Old pick',
    createdAt: '2026-07-04T08:00:00.000Z',
    metadata: {
      sourceId: repeated.id,
      url: repeated.url
    }
  }];

  const push = createDailyPush(companion, {
    sources: [repeated, fresh],
    priorMessages,
    now: '2026-07-06T08:00:00.000Z'
  });

  assert.equal(push.metadata.sourceId, fresh.id);
  assert.match(push.content, /Fresh video/);
});

test('custom keywords create fallback curated content when no source matches fixed categories', () => {
  const companion = createCompanion({
    name: 'Luna',
    pushCategories: ['unknown_category'],
    customKeywords: ['cooking', 'travel']
  });

  const curated = curateContentForCompanion(companion, []);
  const push = createDailyPush(companion, { sources: [], now: '2026-07-03T08:00:00' });

  assert.equal(curated.length, 2);
  assert.deepEqual(curated.map((item) => item.keyword), ['cooking', 'travel']);
  assert.equal(push.metadata.keyword, 'travel');
  assert.match(push.content, /travel|cooking/);
});

test('generates a sample conversation preview from companion settings', () => {
  const preview = generateCompanionPreview({
    name: 'Mia',
    relationshipType: 'Girlfriend',
    personality: 'Warm and playful',
    pushCategories: ['funny_videos'],
    customKeywords: ['cooking'],
    memoryEnabled: true,
    careStyle: {
      intimacyLevel: 'close',
      supportMode: 'gentle_advice',
      proactiveCareFrequency: 'daily'
    }
  });

  assert.equal(preview.companion.name, 'Mia');
  assert.equal(preview.companion.careStyle.supportMode, 'gentle_advice');
  assert.equal(preview.messages.length, 3);
  assert.deepEqual(preview.messages.map((message) => message.role), ['user', 'assistant', 'system_push']);
  assert.match(preview.messages[1].content, /Mia/);
  assert.match(preview.messages[1].content, /one small step|try/i);
  assert.match(preview.messages[2].content, /Daily Pick/);
});

test('updates local user profile and privacy settings', () => {
  const state = createSeedState();

  const updated = updateUserProfile(state.user, {
    displayName: 'Steven',
    email: 'steven@example.com',
    privacy: {
      localOnly: true,
      allowAiTraining: false,
      showPrivacyNotice: false
    }
  });

  assert.equal(updated.displayName, 'Steven');
  assert.equal(updated.email, 'steven@example.com');
  assert.equal(updated.privacy.localOnly, true);
  assert.equal(updated.privacy.allowAiTraining, false);
  assert.equal(updated.privacy.showPrivacyNotice, false);
});
