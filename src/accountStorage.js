const OWNER_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;

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
