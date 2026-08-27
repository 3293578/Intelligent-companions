const OWNER_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;
const REMEMBERED_OWNER_KEY = 'wyth-last-local-owner-v1';

function normalizeOwnerId(userId) {
  const owner = String(userId || '');
  return OWNER_PATTERN.test(owner) ? owner : '';
}

export function accountStorageKey(baseKey, userId = '') {
  const base = String(baseKey || '');
  const owner = String(userId || '');
  if (!base) throw new Error('invalid_storage_key');
  if (!owner) return base;
  if (!OWNER_PATTERN.test(owner)) throw new Error('invalid_storage_owner');
  return `${base}:account:${owner}`;
}

export function migrateGuestStorage(storage, baseKeys, userId) {
  let migrated = 0;
  let removed = 0;
  for (const baseKey of new Set(baseKeys)) {
    const guestValue = storage.getItem(baseKey);
    if (guestValue === null) continue;
    const targetKey = accountStorageKey(baseKey, userId);
    if (storage.getItem(targetKey) === null) {
      storage.setItem(targetKey, guestValue);
      storage.removeItem(baseKey);
      migrated += 1;
      removed += 1;
    }
  }
  return { migrated, removed };
}

export function readRememberedLocalOwner(storage) {
  try {
    return normalizeOwnerId(storage.getItem(REMEMBERED_OWNER_KEY));
  } catch {
    return '';
  }
}

export function rememberLocalOwner(storage, userId) {
  const owner = normalizeOwnerId(userId);
  if (!owner) return false;
  try {
    storage.setItem(REMEMBERED_OWNER_KEY, owner);
    return true;
  } catch {
    return false;
  }
}

export function clearRememberedLocalOwner(storage) {
  try {
    storage.removeItem(REMEMBERED_OWNER_KEY);
    return true;
  } catch {
    return false;
  }
}
