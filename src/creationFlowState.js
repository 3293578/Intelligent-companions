export const ADVANCED_STEPS = Object.freeze([
  'identity',
  'relationship',
  'personality',
  'story',
  'language',
  'voice_scene',
  'review'
]);

const DRAFT_KEYS = Object.freeze([
  'name',
  'relationshipType',
  'personality',
  'backgroundStory',
  'language',
  'sceneId',
  'avatar',
  'visualStyle',
  'voiceId'
]);

const DEFAULT_DRAFT = Object.freeze({
  name: 'Mia',
  relationshipType: 'Bestie',
  personality: 'Warm, present, and easy to talk to',
  backgroundStory: '',
  language: 'english',
  sceneId: 'friend_room',
  avatar: null,
  visualStyle: 'cinematic_semireal',
  voiceId: ''
});

function safeDraft(input = {}) {
  return Object.fromEntries(DRAFT_KEYS.map((key) => [
    key,
    Object.hasOwn(input, key) ? input[key] : DEFAULT_DRAFT[key]
  ]));
}

export function createCreationFlow(input = {}) {
  return {
    mode: input.mode === 'advanced' ? 'advanced' : 'quick',
    step: ADVANCED_STEPS.includes(input.step) ? input.step : 'identity',
    draft: safeDraft(input.draft)
  };
}

export function goToCreationStep(flow, step) {
  if (!ADVANCED_STEPS.includes(step)) throw new Error(`Unknown creation step: ${step}`);
  return { ...flow, mode: 'advanced', step, draft: safeDraft(flow.draft) };
}

export function updateCreationDraft(flow, updates = {}) {
  const allowedUpdates = Object.fromEntries(
    DRAFT_KEYS.filter((key) => Object.hasOwn(updates, key)).map((key) => [key, updates[key]])
  );
  return { ...flow, draft: safeDraft({ ...flow.draft, ...allowedUpdates }) };
}

