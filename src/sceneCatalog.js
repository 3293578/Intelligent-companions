export const SCENE_CATALOG = Object.freeze({
  friend_room: {
    id: 'friend_room',
    labelZh: '窗边客厅',
    baseAsset: 'assets/wyth/scenes/friend-room-base.webp',
    avatarAsset: 'assets/wyth/avatars/friend.svg',
    ambientEffect: 'floating_dust',
    fallback: { colors: ['#1d2928', '#806c5c', '#d7b98d'] }
  },
  listener_rain: {
    id: 'listener_rain',
    labelZh: '雨夜灯房',
    baseAsset: 'assets/wyth/scenes/listener-rain-base.webp',
    avatarAsset: 'assets/wyth/avatars/listener.svg',
    ambientEffect: 'soft_rain',
    fallback: { colors: ['#111a24', '#354352', '#b58b68'] }
  },
  traveler_train: {
    id: 'traveler_train',
    labelZh: '清晨列车',
    baseAsset: 'assets/wyth/scenes/traveler-train-base.webp',
    avatarAsset: 'assets/wyth/avatars/traveler.svg',
    ambientEffect: 'passing_light',
    fallback: { colors: ['#263236', '#71868b', '#d4b47b'] }
  },
  workmate_desk: {
    id: 'workmate_desk',
    labelZh: '暮色书桌',
    baseAsset: 'assets/wyth/scenes/workmate-desk-base.webp',
    avatarAsset: 'assets/wyth/avatars/workmate.svg',
    ambientEffect: 'city_glow',
    fallback: { colors: ['#172126', '#46545c', '#c18e64'] }
  },
  coach_study: {
    id: 'coach_study',
    labelZh: '日光书房',
    baseAsset: 'assets/wyth/scenes/coach-study-base.webp',
    avatarAsset: 'assets/wyth/avatars/coach.svg',
    ambientEffect: 'page_light',
    fallback: { colors: ['#48514b', '#9b927d', '#e1cda6'] }
  }
});

export const WYTH_PRESETS = Object.freeze([
  { id: 'friend', labelZh: '知心朋友', sceneId: 'friend_room', relationshipType: 'Bestie', personality: 'Warm, present, and easy to talk to', careStyle: { supportMode: 'listen_first' } },
  { id: 'listener', labelZh: '安静倾听者', sceneId: 'listener_rain', relationshipType: 'Tree hole', personality: 'Patient, quiet, and never in a hurry to fix things', careStyle: { supportMode: 'listen_first' } },
  { id: 'traveler', labelZh: '旅行伙伴', sceneId: 'traveler_train', relationshipType: 'Bestie', personality: 'Curious, observant, and open to small discoveries', careStyle: { supportMode: 'cheer_up' } },
  { id: 'workmate', labelZh: '职场搭档', sceneId: 'workmate_desk', relationshipType: 'Knowledge brother', personality: 'Calm, capable, and supportive without becoming corporate', careStyle: { supportMode: 'gentle_advice' } },
  { id: 'coach', labelZh: '温柔语言教练', sceneId: 'coach_study', relationshipType: 'Mentor', personality: 'Gentle, encouraging, and responsive when language help is requested', careStyle: { supportMode: 'listen_first' } }
]);

export function fallbackSceneId() {
  return 'friend_room';
}

export function sceneForId(id) {
  return SCENE_CATALOG[id] || SCENE_CATALOG[fallbackSceneId()];
}

export function recommendSceneId(companion = {}) {
  const text = `${companion.relationshipType || ''} ${companion.personality || ''}`.toLowerCase();
  if (/tree hole|listener|quiet|listen/.test(text)) return 'listener_rain';
  if (/travel|adventure|curious discovery/.test(text)) return 'traveler_train';
  if (/mentor|professional|work|knowledge/.test(text)) return 'workmate_desk';
  if (/coach|teacher|language|study/.test(text)) return 'coach_study';
  return fallbackSceneId();
}
