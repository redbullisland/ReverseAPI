// Shared browser-side HTTP helpers. No Next.js server routes are involved.

const TIMEOUT_MS = 20000;

/**
 * Map a direct upstream URL onto an optional, user-controlled CORS proxy.
 *
 * Template tokens:
 *   {url}      - encodeURIComponent(targetUrl) (most proxies expect this)
 *   {rawUrl}   - targetUrl unchanged
 *   {headers}  - repeated `reqHeaders=<encoded "Name: value">` params
 *                (used by corsproxy.io to set the upstream headers)
 *
 * If no token is present, the encoded URL is appended to the template, e.g.
 * `https://proxy.example.com/?` becomes `https://proxy.example.com/?<encoded url>`.
 */
export function buildProxyRequest(targetUrl, headers, proxyTemplate) {
  const template = String(proxyTemplate ?? '').trim();
  if (!template) return { url: targetUrl, headers, proxied: false };

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
