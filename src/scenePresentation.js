const AMBIENT_BY_SCENE = Object.freeze({
  friend_room: { kind: 'curtain_dust', cap: 16, color: 'rgba(239, 204, 151, .22)' },
  listener_rain: { kind: 'rain', cap: 30, color: 'rgba(177, 211, 238, .2)' },
  traveler_train: { kind: 'passing_light', cap: 12, color: 'rgba(247, 220, 173, .18)' },
  workmate_desk: { kind: 'city_glow', cap: 10, color: 'rgba(239, 190, 126, .2)' },
  coach_study: { kind: 'page_light', cap: 14, color: 'rgba(255, 232, 186, .2)' }
});

export function resolveSceneTime(hour = new Date().getHours()) {
  const normalized = Number.isFinite(Number(hour)) ? ((Number(hour) % 24) + 24) % 24 : 12;
  if (normalized >= 5 && normalized <= 11) return 'morning';
  if (normalized >= 12 && normalized <= 19) return 'dusk';
  return 'night';
}

export function resolveAmbientDescriptor(sceneId) {
  return AMBIENT_BY_SCENE[sceneId] || AMBIENT_BY_SCENE.friend_room;
}

export function resolveSupportVisual(presence, options = {}) {
  return {
    presence: presence || 'none',
    motion: options.reduceMotion ? 'static' : 'transform'
  };
}
