const PERMISSIONS = new Set(['default', 'granted', 'denied', 'unsupported']);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createNotificationPreferences() {
  return {
    enabled: false,
    permission: 'default',
    quietHours: { enabled: true, start: '22:30', end: '07:00' }
  };
}

export function normalizeNotificationPreferences(value = {}) {
  const defaults = createNotificationPreferences();
  const permission = PERMISSIONS.has(value.permission) ? value.permission : defaults.permission;
  const start = TIME_PATTERN.test(value.quietHours?.start) ? value.quietHours.start : defaults.quietHours.start;
  const end = TIME_PATTERN.test(value.quietHours?.end) ? value.quietHours.end : defaults.quietHours.end;
  const enabled = permission === 'granted' && Boolean(value.enabled);
  return {
    enabled,
    permission,
    quietHours: {
      enabled: value.quietHours?.enabled === undefined ? defaults.quietHours.enabled : Boolean(value.quietHours.enabled),
      start,
      end
    }
  };
}

export function loadNotificationPreferences(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeNotificationPreferences(JSON.parse(raw)) : createNotificationPreferences();
  } catch {
    return createNotificationPreferences();
  }
}

export function saveNotificationPreferences(storage, key, preferences) {
  try {
    storage.setItem(key, JSON.stringify(normalizeNotificationPreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}
