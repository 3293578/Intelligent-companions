export function createSecurityHeaders({ production = false } = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' https://cdn.paddle.com; connect-src 'self' https://*.paddle.com https://*.paddle.io; frame-src https://*.paddle.com https://*.paddle.io; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ...(production ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {})
  };
}

export function staticCacheControl(pathname = '') {
  const normalized = String(pathname).toLowerCase();
  if (normalized === '/' || normalized.endsWith('/index.html')) {
    return 'no-cache, no-store, must-revalidate';
  }
  if (/\.(?:css|js|mjs|json)$/.test(normalized)) {
    return 'no-cache, must-revalidate';
  }
  if (/\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?)$/.test(normalized)) {
    return 'public, max-age=3600, must-revalidate';
  }
  return 'no-store';
}
