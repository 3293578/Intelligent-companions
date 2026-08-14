import { createHash } from 'node:crypto';

export function isPublicApiPath(pathname = '') {
  return pathname === '/api/health'
    || pathname === '/api/health/ready'
    || pathname.startsWith('/api/auth/');
}

export function scopedMemoryId(userId, companionId) {
  const user = String(userId || '');
  const companion = String(companionId || '');
  if (!user || user.length > 256) throw new Error('invalid_user');
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(companion)) throw new Error('invalid_companion');
  const userHash = createHash('sha256').update(user).digest('hex').slice(0, 32);
  return `u_${userHash}:${companion}`;
}
