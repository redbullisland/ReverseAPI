// Shared browser-side HTTP helpers. No Next.js server routes are involved.

const TIMEOUT_MS = 20000;

// Built-in same-origin relay via next.config.mjs rewrites. Chosen automatically
// when no external proxy template is set, so lookups work without any setup.
const RELAYS = [
  [/^https:\/\/api\.eyecon-app\.com\//, '/p/eyecon/'],
  [/^https:\/\/search5-eu\.truecaller\.com\//, '/p/tc-eu/'],
  [/^https:\/\/search5-noneu\.truecaller\.com\//, '/p/tc-noneu/'],
  [/^https:\/\/search5\.truecaller\.com\//, '/p/tc/'],
];

/**
 * Map a direct upstream URL onto an optional, user-controlled CORS proxy.
 *
 * Template tokens:
 *   {url}      - encodeURIComponent(targetUrl) (most proxies expect this)
 *   {rawUrl}   - targetUrl unchanged
 *   {headers}  - repeated `reqHeaders=<encoded "Name: value">` params
 *                (used by corsproxy.io to set the upstream headers)
 *
 * If no template is set, a built-in same-origin relay (next.config.mjs rewrites)
 * is used automatically for the known upstream hosts, so no user setup is needed.
 * If no token is present in a custom template, the encoded URL is appended, e.g.
 * `https://proxy.example.com/?` becomes `https://proxy.example.com/?<encoded url>`.
 */
export function buildProxyRequest(targetUrl, headers, proxyTemplate) {
  const template = String(proxyTemplate ?? '').trim();
  if (!template) {
    for (const [pattern, prefix] of RELAYS) {
      if (pattern.test(targetUrl)) {
        return {
          url: targetUrl.replace(pattern, prefix),
          headers, // same origin: browser sends the user's own credentials directly
          proxied: true,
        };
      }
    }
    return { url: targetUrl, headers, proxied: false };
  }

  const headerQuery = Object.entries(headers)
    .map(([key, value]) => `reqHeaders=${encodeURIComponent(`${key}:${value}`)}`)
    .join('&');

  let url = template.replaceAll('{url}', () => encodeURIComponent(targetUrl));
  url = url.replaceAll('{rawUrl}', () => targetUrl);
  url = url.replaceAll('{headers}', () => headerQuery);

  const usedToken = /\{(?:url|rawUrl|headers)\}/.test(template);
  if (!usedToken) url += encodeURIComponent(targetUrl);

  return {
    url,
    // When {headers} is used the proxy sets them upstream, so the browser
    // sends none and no CORS preflight is triggered.
    headers: template.includes('{headers}') ? {} : headers,
    proxied: true,
  };
}

export async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
    return { status: response.status, ok: response.ok, text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}
