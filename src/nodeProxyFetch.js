import http from 'node:http';
import tls from 'node:tls';

function splitHttpResponse(raw) {
  const boundary = raw.indexOf('\r\n\r\n');
  if (boundary === -1) return { status: 0, headers: {}, body: raw };
  const head = raw.slice(0, boundary);
  const rawBody = raw.slice(boundary + 4);
  const [statusLine, ...headerLines] = head.split('\r\n');
  const status = Number(statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/)?.[1] || 0);
  const headers = {};
  headerLines.forEach((line) => {
    const index = line.indexOf(':');
    if (index > -1) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  });
  const contentLength = Number.parseInt(headers['content-length'] || '', 10);
  const body = headers['transfer-encoding']?.toLowerCase().includes('chunked')
    ? decodeChunkedBody(rawBody)
    : Number.isFinite(contentLength)
      ? rawBody.slice(0, contentLength)
      : rawBody;
  return { status, headers, body };
}

function decodeChunkedBody(rawBody) {
  let cursor = 0;
  let decoded = '';

  while (cursor < rawBody.length) {
    const sizeEnd = rawBody.indexOf('\r\n', cursor);
    if (sizeEnd === -1) return decoded || rawBody;
    const sizeText = rawBody.slice(cursor, sizeEnd).split(';')[0].trim();
    const size = Number.parseInt(sizeText, 16);
    if (!Number.isFinite(size)) return decoded || rawBody;
    cursor = sizeEnd + 2;
    if (size === 0) return decoded;
    decoded += rawBody.slice(cursor, cursor + size);
    cursor += size + 2;
  }

  return decoded;
}

function parseFirstJsonValue(text) {
  const decoder = new TextDecoder();
  const source = String(text || '');
  for (let end = source.length; end > 0; end -= 1) {
    try {
      const encoded = new TextEncoder().encode(source.slice(0, end));
      const value = JSON.parse(decoder.decode(encoded));
      return value;
    } catch {
      // Keep trimming until the first complete JSON value parses.
    }
  }
  return JSON.parse(source);
}

const defaultProxyClient = {
  request(proxy, targetUrl, requestText) {
    return new Promise((resolve, reject) => {
      const connectRequest = http.request({
        host: proxy.hostname,
        port: Number(proxy.port || 80),
        method: 'CONNECT',
        path: `${targetUrl.hostname}:443`,
        timeout: 15000
      });

      connectRequest.on('connect', (response, socket) => {
        if (response.statusCode !== 200) {
          socket.destroy();
          reject(new Error(`Proxy CONNECT failed with ${response.statusCode}`));
          return;
        }
        const secureSocket = tls.connect({ socket, servername: targetUrl.hostname }, () => {
          secureSocket.write(requestText);
        });
        const chunks = [];
        secureSocket.on('data', (chunk) => chunks.push(chunk));
        secureSocket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        secureSocket.on('error', reject);
      });

      connectRequest.on('timeout', () => {
        connectRequest.destroy(new Error('Proxy CONNECT timed out'));
      });
      connectRequest.on('error', reject);
      connectRequest.end();
    });
  }
};

function normalizeRequestHeaders(headers = {}) {
  if (typeof headers.entries === 'function') {
    return Object.fromEntries(headers.entries());
  }
  return { ...headers };
}

function buildRequestText(targetUrl, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? String(options.body) : '';
  const headers = {
    Host: targetUrl.hostname,
    'User-Agent': 'EnglishCompanions/0.1',
    Accept: 'application/rss+xml, application/json, text/plain, */*',
    ...normalizeRequestHeaders(options.headers),
    Connection: 'close'
  };
  if (body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return [
    `${method} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1`,
    ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
    '',
    body
  ].join('\r\n');
}

export async function fetchTextThroughHttpProxy(url, options = {}) {
  const proxy = new URL(options.proxyUrl);
  const targetUrl = new URL(url);
  const requestText = buildRequestText(targetUrl, options);
  const client = options.proxyClient || defaultProxyClient;
  return splitHttpResponse(await client.request(proxy, targetUrl, requestText));
}

function resolveRedirectUrl(currentUrl, location) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return '';
  }
}

export function createProxyFetch(proxyUrl, options = {}) {
  const maxRedirects = Number(options.maxRedirects ?? 5);

  return async function proxyFetch(url, requestOptions = {}) {
    let nextUrl = url;
    let redirects = 0;

    while (true) {
      const result = await fetchTextThroughHttpProxy(nextUrl, {
        ...requestOptions,
        proxyUrl,
        proxyClient: options.proxyClient
      });
      if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location && redirects < maxRedirects) {
        const redirectedUrl = resolveRedirectUrl(nextUrl, result.headers.location);
        if (!redirectedUrl) break;
        nextUrl = redirectedUrl;
        redirects += 1;
        continue;
      }

      return {
        ok: result.status >= 200 && result.status < 400,
        status: result.status,
        headers: {
          get(name) {
            return result.headers[String(name).toLowerCase()] || '';
          }
        },
        async text() {
          return result.body;
        },
        async json() {
          return parseFirstJsonValue(result.body);
        }
      };
    }

    throw new Error('Unable to resolve proxy redirect.');
  };
}
