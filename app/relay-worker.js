/**
 * Free Cloudflare Worker — portable CORS relay for the lookup app.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create Worker → paste this file,
 * or: npm i -g wrangler && wrangler login && wrangler deploy relay-worker.js
 *
 * Then set the app's "Proxy URL template" to:
 *   https://<your-worker>.workers.dev/?url={url}&{headers}
 *
 * The app's {headers} token already emits reqHeaders=<encoded "Name: value"> params,
 * which this worker forwards upstream. The browser sends NO custom headers to the
 * worker, so there is no CORS preflight.
 *
 * Why this exists: TrueCaller's WAF accepts browser/Schannel TLS but rejects the
 * OpenSSL stack used by Node-based proxies. Cloudflare's outbound TLS is a different
 * stack — deploying this is the cheapest portable test of whether it passes.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function text(message, status) {
  return withCors(new Response(message, { status, headers: { 'Content-Type': 'text/plain' } }));
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') return text('GET only', 405);

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get('url');
    if (!target) return text('Missing ?url=', 400);

    let upstreamUrl;
    try {
      upstreamUrl = new URL(target);
    } catch {
      return text('Invalid url', 400);
    }
    // Only allow the two known API hosts — this is a personal relay, not an open proxy.
    const ALLOWED = ['api.eyecon-app.com', 'search5.truecaller.com',
      'search5-eu.truecaller.com', 'search5-noneu.truecaller.com', 'apilayer.net'];
    if (!ALLOWED.includes(upstreamUrl.hostname)) return text('Host not allowed', 403);

    const headers = new Headers();
    // App's {headers} token format: reqHeaders=<encoded "Name: value">
    for (const raw of incoming.searchParams.getAll('reqHeaders')) {
      const split = raw.indexOf(':');
      if (split > 0) headers.set(raw.slice(0, split).trim(), raw.slice(split + 1).trim());
    }
    // Convenience format: h_<name>=<value>
    for (const [key, value] of incoming.searchParams) {
      if (key.startsWith('h_') && key.length > 2) headers.set(key.slice(2), value);
    }

    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'follow',
      });
      return withCors(upstream);
    } catch (error) {
      return text(`Upstream failed: ${error.message}`, 502);
    }
  },
};
