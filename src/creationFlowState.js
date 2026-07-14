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

const RELATIONSHIPS = new Set(['Girlfriend', 'Boyfriend', 'Bestie', 'Mentor', 'Tree hole', 'Knowledge brother']);
const ROMANTIC_RELATIONSHIPS = new Set(['Girlfriend', 'Boyfriend']);
const LANGUAGES = new Set(['english', 'japanese', 'korean', 'french', 'spanish', 'german', 'italian']);
const SCENES = new Set(['friend_room', 'listener_rain', 'traveler_train', 'workmate_desk', 'coach_study']);
const VISUAL_STYLES = new Set(['cinematic_semireal', 'digital_human', 'illustration']);

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

export function validateCreationStep(flow, options = {}) {
  const { draft, step } = flow;
  if (step === 'identity') {
    if (!String(draft.name || '').trim()) return { ok: false, error: 'name_required', field: 'name' };
    if (!VISUAL_STYLES.has(draft.visualStyle)) return { ok: false, error: 'visual_style_invalid', field: 'visualStyle' };
  }
  if (step === 'relationship') {
    if (!RELATIONSHIPS.has(draft.relationshipType)) return { ok: false, error: 'relationship_invalid', field: 'relationshipType' };
    if (options.ageGroup === 'minor' && ROMANTIC_RELATIONSHIPS.has(draft.relationshipType)) {
      return { ok: false, error: 'relationship_minor', field: 'relationshipType' };
    }
  }
  if (step === 'personality' && !String(draft.personality || '').trim()) {
    return { ok: false, error: 'personality_required', field: 'personality' };
  }
  if (step === 'language' && !LANGUAGES.has(draft.language)) {
    return { ok: false, error: 'language_invalid', field: 'language' };
  }
  if (step === 'voice_scene' && !SCENES.has(draft.sceneId)) {
    return { ok: false, error: 'scene_invalid', field: 'sceneId' };
  }
  return { ok: true };
}

export function canSubmitCreation(flow) {
  return flow.mode === 'quick' || (flow.mode === 'advanced' && flow.step === 'review');
}

export function selectVisualStyle(currentStyle, explicitlySelectedStyle) {
  return VISUAL_STYLES.has(explicitlySelectedStyle) ? explicitlySelectedStyle : currentStyle;
}
