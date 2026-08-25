import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentRetrievalPlan,
  buildCompanionSystemPrompt,
  buildWelcomeContent,
  CATEGORY_LIBRARY,
  createAssistantReply,
  createCompanion,
  createDailyPush,
  createEmptyState,
  createSeedState,
  createUserMessage,
  curateContentForCompanion,
  detectUserEmotion,
  deserializeState,
  generateCompanionPreview,
  LANGUAGE_LIBRARY,
  normalizeRetrievedContent,
  previewNotification,
  runScheduledDailyPushes,
  hasSchedulerStateChanged,
  serializeState,
  stopPushCategory,
  updateCompanion,
  updateUserProfile,
  updateMemory
} from '../src/companionLogic.js';

test('new Wyth installations start empty so the first-use companion chooser can render', () => {
  const state = createEmptyState();
  assert.equal(state.companions.length, 0);
  assert.equal(state.messages.length, 0);
  assert.equal(state.selectedCompanionId, '');
  assert.equal(state.user.privacy.localOnly, true);
});

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

test('companions receive a Wyth scene and default avatar without proactive correction', () => {
  const companion = createCompanion({ name: 'Mia', relationshipType: 'Tree hole' });

  assert.equal(companion.sceneId, 'listener_rain');
  assert.deepEqual(companion.avatar, { kind: 'default', dataUrl: '', mimeType: '' });
  assert.equal(companion.practiceStyle.correctionMode, 'off');
});

test('deserializes old companions with deterministic Wyth visual fields', () => {
  const restored = deserializeState(JSON.stringify({
    selectedCompanionId: 'old',
    companions: [{ id: 'old', name: 'Old friend', relationshipType: 'Bestie', personality: 'Warm' }],
    messages: []
  }));

  assert.equal(restored.companions[0].sceneId, 'friend_room');
  assert.deepEqual(restored.companions[0].avatar, { kind: 'default', dataUrl: '', mimeType: '' });
});

test('preserves a custom avatar when unrelated companion details change', () => {
  const companion = createCompanion({
    name: 'Mia',
    avatar: { kind: 'custom', dataUrl: 'data:image/webp;base64,abc', mimeType: 'image/webp' }
  });

  assert.equal(updateCompanion(companion, { personality: 'Calm' }).avatar.kind, 'custom');
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

test('local support replies acknowledge the user without diagnosing or over-questioning', () => {
  const companion = createCompanion({ name: 'Luna', careStyle: { supportMode: 'listen_first' } });
  const reply = createAssistantReply(
    companion,
    createUserMessage(companion.id, 'I feel exhausted after today.'),
    []
  );

  assert.match(reply.content, /exhausted|heavy|a lot/i);
  assert.doesNotMatch(reply.content, /diagnos|definitely|you have/i);
  assert.equal((reply.content.match(/\?/g) || []).length <= 1, true);
  assert.equal(reply.metadata.support.level, 'light');
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
  assert.match(prompt, /natural English phrase/i);
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
  assert.equal(restored.user.birthday, '');
  assert.equal(restored.user.ageGroup, 'unknown');
  assert.equal(restored.user.gender, '');
  assert.equal(restored.user.preferredCompanionGender, '');
  assert.equal(restored.user.interfaceLocale, 'zh-CN');
  assert.equal('romanceAllowed' in restored.user, false);
});

test('state factories deep clone nested user privacy', () => {
  const seedA = createSeedState();
  const seedB = createSeedState();
  const missingUser = deserializeState(JSON.stringify({ companions: [], messages: [] }));

  assert.notEqual(seedA.user.privacy, seedB.user.privacy);
  assert.notEqual(seedA.user.privacy, missingUser.user.privacy);
  seedA.user.privacy.localOnly = false;
  assert.equal(seedB.user.privacy.localOnly, true);
  assert.equal(missingUser.user.privacy.localOnly, true);
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
    now: '2026-07-03T08:30:00Z'
  });
  const muted = previewNotification(companion, push, {
    enabled: true,
    quietHours: { enabled: true, start: '23:00', end: '07:00' },
    now: '2026-07-03T23:30:00Z'
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
    now: '2026-07-03T07:30:00Z',
    proactiveContactOverride: 'off',
    notificationPreferences: { enabled: true }
  });
  const onTime = runScheduledDailyPushes(state, {
    now: '2026-07-03T08:05:00Z',
    proactiveContactOverride: 'off',
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
    createdAt: '2026-07-03T08:10:00Z'
  };
  const state = {
    selectedCompanionId: companion.id,
    companions: [companion],
    messages: [existingPush]
  };

  const result = runScheduledDailyPushes(state, {
    now: '2026-07-03T19:00:00Z',
    proactiveContactOverride: 'off',
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
    now: '2026-07-03T08:05:00Z',
    proactiveContactOverride: 'off',
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
  rarely.createdAt = '2026-07-04T10:00:00.000Z';
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
  const push = createDailyPush(companion, { sources: [], now: '2026-07-03T08:00:00Z' });

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

test('quick proactive override controls care check-ins without suppressing Daily Picks', () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    careStyle: { proactiveCareFrequency: 'daily' },
    pushCategories: ['healing_news'],
    pushTime: '08:00',
    maxDaily: 1
  });
  companion.createdAt = '2026-07-05T08:00:00.000Z';
  const state = { selectedCompanionId: companion.id, companions: [companion], messages: [] };

  const off = runScheduledDailyPushes(state, {
    now: '2026-07-06T09:00:00.000Z',
    proactiveContactOverride: 'off',
    notificationPreferences: { enabled: true }
  });
  assert.equal(off.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 0);
  assert.equal(off.messages.filter((message) => message.role === 'system_push').length, 1);

  const daily = runScheduledDailyPushes(state, {
    now: '2026-07-05T09:00:00.000Z',
    proactiveContactOverride: 'daily',
    notificationPreferences: { enabled: true }
  });
  const rarely = runScheduledDailyPushes(state, {
    now: '2026-07-05T09:00:00.000Z',
    proactiveContactOverride: 'rarely',
    notificationPreferences: { enabled: true }
  });
  assert.equal(daily.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
  assert.equal(rarely.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 0);
});

test('rare proactive override waits seven days since the latest care check-in', () => {
  const companion = createCompanion({
    id: 'companion_luna',
    name: 'Luna',
    pushTime: '23:00',
    careStyle: { proactiveCareFrequency: 'daily' }
  });
  companion.createdAt = '2026-07-05T08:00:00.000Z';
  const previous = {
    id: 'care_previous',
    companionId: companion.id,
    role: 'assistant',
    content: 'Checking in.',
    createdAt: '2026-07-01T09:00:00.000Z',
    metadata: { kind: 'care_check_in' }
  };
  const state = { companions: [companion], messages: [previous] };
  const recent = runScheduledDailyPushes(state, {
    now: '2026-07-07T10:00:00.000Z',
    proactiveContactOverride: 'rarely'
  });
  const due = runScheduledDailyPushes(state, {
    now: '2026-07-08T10:00:00.000Z',
    proactiveContactOverride: 'rarely'
  });
  assert.equal(recent.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
  assert.equal(due.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 2);
});

test('rare proactive override anchors its first check-in to companion creation time', () => {
  const base = createCompanion({ id: 'companion_luna', name: 'Luna', pushTime: '23:00' });
  const companion = { ...base, createdAt: '2026-07-01T10:00:00.000Z' };
  const state = { companions: [companion], messages: [] };
  const early = runScheduledDailyPushes(state, {
    now: '2026-07-07T09:59:00.000Z',
    proactiveContactOverride: 'rarely'
  });
  const due = runScheduledDailyPushes(state, {
    now: '2026-07-08T10:00:00.000Z',
    proactiveContactOverride: 'rarely'
  });
  assert.equal(early.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 0);
  assert.equal(due.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
});

test('rare proactive override allows one initial check-in for legacy companions without timestamps', () => {
  const companion = createCompanion({ id: 'companion_legacy', name: 'Legacy', pushTime: '23:00' });
  delete companion.createdAt;
  const result = runScheduledDailyPushes({ companions: [companion], messages: [] }, {
    now: '2026-07-08T10:00:00.000Z',
    proactiveContactOverride: 'rarely'
  });
  assert.equal(result.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
});

test('scheduler ignores invalid message dates and detects whether state changed', () => {
  const companion = createCompanion({ id: 'companion_safe', pushTime: '23:00', maxDaily: 1 });
  const state = { companions: [companion], messages: [{ id: 'bad', companionId: companion.id, role: 'system_push', createdAt: 'not-a-date' }] };
  const unchanged = runScheduledDailyPushes(state, { now: '2026-07-08T10:00:00.000Z', proactiveContactOverride: 'off' });
  assert.equal(hasSchedulerStateChanged(state, unchanged), false);
  const changed = runScheduledDailyPushes(state, { now: '2026-07-08T23:30:00.000Z', proactiveContactOverride: 'off' });
  assert.equal(hasSchedulerStateChanged(state, changed), true);
});

test('scheduler uses one explicit calendar offset across UTC midnight', () => {
  const companion = createCompanion({ id: 'companion_tz', pushTime: '00:30', maxDaily: 1 });
  const prior = { ...createDailyPush(companion), createdAt: '2026-07-08T23:40:00.000Z' };
  const state = { companions: [companion], messages: [prior] };
  const result = runScheduledDailyPushes(state, {
    now: '2026-07-09T00:10:00.000Z',
    timezoneOffsetMinutes: 120,
    proactiveContactOverride: 'off'
  });
  assert.equal(result.messages.length, 1, 'both timestamps are July 9 in UTC+2');
});

test('quiet hours suppress care check-ins but leave scheduled Daily Picks available', () => {
  const companion = createCompanion({ id: 'companion_quiet', pushTime: '22:00', maxDaily: 1 });
  const result = runScheduledDailyPushes({ companions: [companion], messages: [] }, {
    now: '2026-07-08T23:00:00.000Z',
    proactiveContactOverride: 'daily',
    notificationPreferences: { enabled: true, quietHours: { enabled: true, start: '22:30', end: '07:00' } }
  });
  assert.equal(result.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 0);
  assert.equal(result.messages.filter((message) => message.role === 'system_push').length, 1);
});

test('Daily Pick notification quiet hours use the same positive and negative calendar offsets', () => {
  const companion = createCompanion({ id: 'companion_notify_tz', pushTime: '00:00', maxDaily: 1 });
  const positive = runScheduledDailyPushes({ companions: [companion], messages: [] }, {
    now: '2026-07-08T06:05:00.000Z',
    timezoneOffsetMinutes: 120,
    proactiveContactOverride: 'off',
    notificationPreferences: { enabled: true, quietHours: { enabled: true, start: '22:30', end: '07:00' } }
  });
  const negative = runScheduledDailyPushes({ companions: [companion], messages: [] }, {
    now: '2026-07-09T04:00:00.000Z',
    timezoneOffsetMinutes: -300,
    proactiveContactOverride: 'off',
    notificationPreferences: { enabled: true, quietHours: { enabled: true, start: '22:30', end: '07:00' } }
  });
  assert.equal(positive.notifications.length, 1, 'UTC+2 local time is 08:05 and not quiet');
  assert.equal(negative.notifications.length, 0, 'UTC-5 local time is 23:00 and quiet');
});

test('future care and creation anchors are ignored safely', () => {
  const companion = { ...createCompanion({ id: 'companion_future', pushTime: '23:00' }), createdAt: '2030-01-01T00:00:00.000Z' };
  const futureCare = { id: 'future', companionId: companion.id, role: 'assistant', createdAt: '2030-01-02T00:00:00.000Z', metadata: { kind: 'care_check_in' } };
  const result = runScheduledDailyPushes({ companions: [companion], messages: [futureCare] }, {
    now: '2026-07-08T10:00:00.000Z', proactiveContactOverride: 'rarely'
  });
  assert.equal(result.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 2);
});

test('push schedules normalize invalid time and maxDaily on create, update, and deserialize', () => {
  const created = createCompanion({ pushTime: '99:90', maxDaily: 'x' });
  assert.deepEqual(created.pushSchedule, { ...created.pushSchedule, time: '08:00', maxDaily: 1 });
  const updated = updateCompanion(created, { pushTime: '7:00', maxDaily: 99, timezone: 'Ignored/Legacy' });
  assert.equal(updated.pushSchedule.time, '08:00');
  assert.equal(updated.pushSchedule.maxDaily, 5);
  const restored = deserializeState(JSON.stringify({ companions: [{ ...created, pushSchedule: { time: 'bad', maxDaily: Infinity, timezone: 'UTC' } }], messages: [] }));
  assert.equal(restored.companions[0].pushSchedule.time, '08:00');
  assert.equal(restored.companions[0].pushSchedule.maxDaily, 1);
});

test('sometimes proactive cadence uses a two-day anchor instead of calendar parity', () => {
  const companion = { ...createCompanion({ id: 'companion_some', pushTime: '23:00' }), createdAt: '2026-07-01T10:00:00.000Z' };
  const state = { companions: [companion], messages: [] };
  const early = runScheduledDailyPushes(state, { now: '2026-07-03T09:59:00.000Z', proactiveContactOverride: 'sometimes' });
  const due = runScheduledDailyPushes(state, { now: '2026-07-03T10:00:00.000Z', proactiveContactOverride: 'sometimes' });
  assert.equal(early.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 0);
  assert.equal(due.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 1);
  const next = runScheduledDailyPushes(due, { now: '2026-07-05T10:00:00.000Z', proactiveContactOverride: 'sometimes' });
  assert.equal(next.messages.filter((message) => message.metadata?.kind === 'care_check_in').length, 2);
});

test('retrieved content rejects non-http URLs', () => {
  assert.equal(normalizeRetrievedContent('web', { id: 'bad-js', title: 'Bad', url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeRetrievedContent('web', { id: 'bad-data', title: 'Bad data', url: 'data:text/html,bad' }), null);
  assert.equal(normalizeRetrievedContent('web', { id: 'good', title: 'Good', url: 'https://example.com/good' }).id, 'good');
});

test('updates onboarding profile fields while preserving privacy and deriving age', () => {
  const state = createSeedState();

  const updated = updateUserProfile(state.user, {
    birthday: '2008-07-15',
    gender: 'woman',
    preferredCompanionGender: 'man',
    interfaceLocale: 'en-US',
    privacy: { showPrivacyNotice: false },
    romanceAllowed: true
  }, '2026-07-14');

  assert.equal(updated.birthday, '2008-07-15');
  assert.equal(updated.ageGroup, 'minor');
  assert.equal(updated.gender, 'woman');
  assert.equal(updated.preferredCompanionGender, 'man');
  assert.equal(updated.interfaceLocale, 'en');
  assert.equal(updated.privacy.localOnly, true);
  assert.equal(updated.privacy.showPrivacyNotice, false);
  assert.equal('romanceAllowed' in updated, false);
});

test('deserializeState re-derives age and rejects persisted romance authorization', () => {
  const oldState = {
    selectedCompanionId: '',
    companions: [],
    messages: [],
    user: {
      birthday: '2010-01-01',
      ageGroup: 'adult',
      romanceAllowed: true,
      privacy: { localOnly: false, allowAiTraining: true, showPrivacyNotice: false }
    }
  };

  const restored = deserializeState(JSON.stringify(oldState), '2026-07-14');

  assert.equal(restored.user.ageGroup, 'minor');
  assert.equal('romanceAllowed' in restored.user, false);
  assert.equal(restored.user.privacy.localOnly, false);
  assert.equal(restored.user.privacy.allowAiTraining, true);
  assert.equal(restored.user.privacy.showPrivacyNotice, false);
});

test('user migration normalizes privacy booleans and preserves identity metadata', () => {
  const restored = deserializeState(JSON.stringify({
    selectedCompanionId: '',
    companions: [],
    messages: [],
    user: {
      id: 'user_42',
      displayName: 'Mira',
      email: 'mira@example.com',
      createdAt: '2024-01-02T03:04:05.000Z',
      lastSeenAt: '2026-07-13T09:00:00.000Z',
      birthday: '2000-01-01',
      privacy: {
        localOnly: 'false',
        allowAiTraining: 1,
        showPrivacyNotice: null
      }
    }
  }), '2026-07-14');

  assert.equal(restored.user.id, 'user_42');
  assert.equal(restored.user.createdAt, '2024-01-02T03:04:05.000Z');
  assert.equal(restored.user.lastSeenAt, '2026-07-13T09:00:00.000Z');
  assert.equal(restored.user.displayName, 'Mira');
  assert.equal(restored.user.ageGroup, 'adult');
  assert.deepEqual(restored.user.privacy, {
    localOnly: true,
    allowAiTraining: false,
    showPrivacyNotice: true
  });
});

test('local fallback replies never leak raw memory template text', () => {
  const companion = createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    memoryEnabled: true,
    memorySummary: 'User shared: why you always say still remember.'
  });
  const positive = createAssistantReply(companion, createUserMessage(companion.id, 'I had a great day.'), []);
  const negative = createAssistantReply(companion, createUserMessage(companion.id, 'I feel sad today.'), []);

  for (const reply of [positive, negative]) {
    assert.ok(!reply.content.includes('I still remember'));
    assert.ok(!reply.content.includes('User shared'));
    assert.ok(!reply.content.includes('as your girlfriend'));
  }
});

test('companion system prompt bans robotic template phrasing', () => {
  const prompt = buildCompanionSystemPrompt(createCompanion({
    name: 'Luna',
    relationshipType: 'Girlfriend',
    personality: 'Gentle and playful'
  }));

  assert.match(prompt, /Sound like a real person/i);
  assert.match(prompt, /never quote memory notes verbatim/i);
  assert.match(prompt, /at most one question per reply/i);
  assert.match(prompt, /Avoid repeating the same opening line/i);
});

test('createCompanion defaults language to english and normalizes unknown values', () => {
  assert.equal(createCompanion({ name: 'Luna' }).language, 'english');
  assert.equal(createCompanion({ name: 'Aki', language: 'Japanese' }).language, 'japanese');
  assert.equal(createCompanion({ name: 'X', language: 'klingon' }).language, 'english');
});

test('companion creation stores advanced identity fields with safe defaults', () => {
  const defaults = createCompanion({ name: 'Mia' });
  const custom = createCompanion({
    name: 'Aki',
    backgroundStory: 'A patient night-train photographer.',
    visualStyle: 'illustration',
    voiceId: 'warm_alto'
  });

  assert.equal(defaults.backgroundStory, '');
  assert.equal(defaults.visualStyle, 'cinematic_semireal');
  assert.equal(defaults.voiceId, '');
  assert.equal(custom.backgroundStory, 'A patient night-train photographer.');
  assert.equal(custom.visualStyle, 'illustration');
  assert.equal(custom.voiceId, 'warm_alto');
});

test('companion updates advanced fields without losing runtime configuration', () => {
  const companion = createCompanion({
    name: 'Mia',
    backgroundStory: 'Old story',
    customKeywords: ['cafes'],
    pushCategories: ['music'],
    contentSources: { enabledProviders: ['news'] },
    memorySummary: 'Likes rain.',
    careStyle: { supportMode: 'listen_first' },
    practiceStyle: { correctionMode: 'off' }
  });
  const updated = updateCompanion(companion, {
    backgroundStory: 'New story', visualStyle: 'digital_human', voiceId: ''
  });

  assert.equal(updated.backgroundStory, 'New story');
  assert.equal(updated.visualStyle, 'digital_human');
  assert.deepEqual(updated.customKeywords, companion.customKeywords);
  assert.deepEqual(updated.pushCategories, companion.pushCategories);
  assert.deepEqual(updated.contentSources, companion.contentSources);
  assert.equal(updated.memorySummary, 'Likes rain.');
  assert.deepEqual(updated.careStyle, companion.careStyle);
  assert.deepEqual(updated.practiceStyle, companion.practiceStyle);
});

test('stored companions migrate missing advanced creation fields', () => {
  const restored = deserializeState(JSON.stringify({
    user: {},
    selectedCompanionId: 'legacy',
    companions: [{ id: 'legacy', name: 'Legacy', relationshipType: 'Bestie' }],
    messages: []
  }));

  assert.equal(restored.companions[0].backgroundStory, '');
  assert.equal(restored.companions[0].visualStyle, 'cinematic_semireal');
  assert.equal(restored.companions[0].voiceId, '');
});

test('updateCompanion can change the practice language', () => {
  const companion = createCompanion({ name: 'Sora', language: 'english' });
  assert.equal(updateCompanion(companion, { language: 'korean' }).language, 'korean');
  // Unspecified language is preserved.
  assert.equal(updateCompanion(companion, { personality: 'calm' }).language, 'english');
});

test('system prompt instructs the companion to speak the chosen language', () => {
  const jp = buildCompanionSystemPrompt(createCompanion({ name: 'Aki', language: 'japanese' }));
  assert.match(jp, /practice Japanese/);
  assert.match(jp, /colloquial Japanese/);
  assert.ok(!jp.includes('colloquial English'));

  const fr = buildCompanionSystemPrompt(createCompanion({ name: 'Elo', language: 'french' }));
  assert.match(fr, /colloquial French/);
});

test('deserializeState normalizes missing language on stored companions', () => {
  const raw = JSON.stringify({
    user: null,
    selectedCompanionId: 'c1',
    companions: [{ id: 'c1', name: 'Old', pushSchedule: { time: '08:00', maxDaily: 1 } }],
    messages: []
  });
  const state = deserializeState(raw);
  assert.equal(state.companions[0].language, 'english');
});

test('LANGUAGE_LIBRARY exposes the supported practice languages', () => {
  assert.ok(LANGUAGE_LIBRARY.english);
  assert.ok(LANGUAGE_LIBRARY.japanese);
  assert.equal(LANGUAGE_LIBRARY.korean.translateTarget, 'Korean');
});

test('welcome content is written in the companion practice language', () => {
  const enWelcome = buildWelcomeContent(createCompanion({ name: 'Luna', language: 'english' }));
  assert.match(enWelcome, /Luna/);
  assert.match(enWelcome, /English/);

  const koWelcome = buildWelcomeContent(createCompanion({ name: 'Fina', language: 'korean' }));
  assert.match(koWelcome, /Fina/);
  assert.match(koWelcome, /[가-힣]/); // contains Hangul
  assert.ok(!/[a-z]{4,}/.test(koWelcome.replace('Fina', ''))); // no long English words besides the name

  const jaWelcome = buildWelcomeContent(createCompanion({ name: 'Aki', language: 'japanese' }));
  assert.match(jaWelcome, /[ぁ-んァ-ン一-鿿]/); // contains kana/kanji
});

test('scheduled care check-in is generated in the companion practice language', () => {
  const korean = createCompanion({
    id: 'c_ko',
    name: 'Fina',
    language: 'korean',
    pushTime: '08:00',
    careStyle: { proactiveCareFrequency: 'daily' }
  });
  const state = { user: null, selectedCompanionId: korean.id, companions: [korean], messages: [] };
  // Use an even day so the daily check-in fires deterministically.
  const result = runScheduledDailyPushes(state, { now: '2026-07-06T09:00:00Z' });
  const checkIn = result.messages.find((m) => m.metadata?.kind === 'care_check_in');

  assert.ok(checkIn, 'expected a care check-in to be generated');
  assert.match(checkIn.content, /Fina/);
  assert.match(checkIn.content, /[가-힣]/); // Korean text, not English
});
