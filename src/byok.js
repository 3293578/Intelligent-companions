import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function invalid() {
  return Object.assign(new Error('model_configuration_required'), { status: 400 });
}

// Credentials are request-scoped. Never fall back to an operator's environment.
export function parseModelConfiguration(header) {
  if (typeof header !== 'string' || header.length > 12000) throw invalid();
  let value;
  try { value = JSON.parse(decodeURIComponent(header)); } catch { throw invalid(); }
  if (!value || typeof value !== 'object') throw invalid();
  const { model, apiKey } = value;
  if (typeof model !== 'string' || !model.trim() || model.length > 160 || /[\x00-\x1f\x7f]/.test(model)) throw invalid();
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 2048 || /[^\x21-\x7e]/.test(apiKey)) throw invalid();
  let url;
  try { url = new URL(value.baseUrl); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || (url.port && url.port !== '443') || isIP(url.hostname) || url.hostname.includes(':')
      || !url.hostname.includes('.') || url.hostname.endsWith('.') || url.href.length > 2048) throw invalid();
  url.pathname = url.pathname.replace(/\/(chat\/completions|responses)\/?$/, '').replace(/\/$/, '');
  return { model: model.trim(), apiKey, baseUrl: url.href.replace(/\/$/, ''),
    apiMode: value.apiMode === 'responses' ? 'responses' : 'chat_completions' };
}

export function isPublicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}

// Resolve once and pin the address in TLS's lookup callback: prevents DNS rebinding.
// No redirects or local proxy fallback are permitted for user-selected destinations.
export function createByokFetch(config, { resolve = lookup, request = https.request } = {}) {
  const base = new URL(config.baseUrl);
  const allowed = new Set([`${config.baseUrl}/chat/completions`, `${config.baseUrl}/responses`]);
  return async (input, options = {}) => {
    if (!allowed.has(String(input)) || options.method !== 'POST') throw new Error('invalid_model_destination');
    const signal = AbortSignal.any([options.signal || new AbortController().signal, AbortSignal.timeout(25000)]);
    const records = await new Promise((accept, reject) => {
      const abort = () => reject(new Error('model_timeout'));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => resolve(base.hostname, { all: true, family: 4 })).then(accept, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    });
    if (!records.length || records.some(({ address }) => !isPublicIPv4(address))) throw new Error('invalid_model_destination');
    if (signal.aborted) throw new Error('model_timeout');
    return new Promise((accept, reject) => {
      const req = request(new URL(input), {
        method: 'POST', agent: false, signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        lookup(_hostname, lookupOptions, callback) {
          const pinned = { address: records[0].address, family: 4 };
          if (lookupOptions.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        }
      }, (res) => {
        // A null-body HTTP status must never throw from an EventEmitter callback.
        if (!Number.isInteger(res.statusCode) || res.statusCode < 200 || res.statusCode > 599
            || [204, 205, 304].includes(res.statusCode)) {
          res.destroy(); reject(new Error('invalid_model_response')); return;
        }
        if (res.statusCode >= 300 && res.statusCode < 400) {
          res.destroy(); reject(new Error('model_redirect_not_allowed')); return;
        }
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 1024 * 1024) { res.destroy(new Error('model_response_too_large')); return; }
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('model_response_aborted')));
        res.on('end', () => {
          try { accept(new Response(Buffer.concat(chunks), { status: res.statusCode })); }
          catch { reject(new Error('invalid_model_response')); }
        });
      });
      req.on('error', reject);
      req.end(options.body);
    });
  };
}

export function createConcurrencyGate({ totalLimit = 12, userLimit = 2 } = {}) {
  const users = new Map();
  let total = 0;
  return function acquire(user) {
    if (total >= totalLimit || (users.get(user) || 0) >= userLimit) return null;
    total += 1;
    users.set(user, (users.get(user) || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      total -= 1;
      const remaining = users.get(user) - 1;
      if (remaining) users.set(user, remaining); else users.delete(user);
    };
  };
}
