// TrueCaller /v2/search — reconstructed from v26.43.5 static analysis.
// NOT live-verified yet: the request shape is from truecaller_research/TRUE_CALLER_ENDPOINTS.md.
// The one thing that cannot be derived statically is a real Bearer token, so the user pastes it.
import { buildProxyRequest, fetchText } from './http';
import { normalizeNumber } from './eyecon';

export const id = 'truecaller';
export const name = 'TrueCaller';
export const placeholder = false;

// Rendered automatically by the UI's per-provider credentials section.
export const SECRET_FIELDS = [
  {
    key: 'token',
    label: 'Bearer token',
    help: 'Paste the Authorization token from your own signed-in TrueCaller app. Stored only in this browser.',
  },
  {
    key: 'host',
    label: 'Search host',
    help: 'search5 (default), search5-eu, or search5-noneu — the app selects by region.',
  },
  {
    key: 'type',
    label: 'Search type',
    help: '2 = caller ID (recommended); 4 = global search; 19/20 = other lookup contexts.',
  },
  {
    key: 'accept',
    label: 'Accept header',
    help: 'application/json (default). The stock app declares application/x-protobuf and adds encoding=json; try that here if JSON is rejected.',
  },
];

export const DEFAULT_SECRETS = {
  token: '',
  host: 'search5',
  type: '2',
  accept: 'application/json',
};

const HOSTS = new Set(['search5', 'search5-eu', 'search5-noneu']);

/** Build the reconstructed GET /v2/search request. No signature/HMAC on this path. */
export function buildRequest({
  number,
  dialCode,
  countryCode,
  token,
  host = 'search5',
  type = '2',
  accept = 'application/json',
}) {
  const digits = normalizeNumber(number, dialCode); // E164 digits, trunk 0 stripped
  const cleanHost = HOSTS.has(host) ? host : 'search5';
  const params = new URLSearchParams({
    q: `+${digits}`, // URLSearchParams encodes "+" as %2B
    countryCode: String(countryCode ?? '').toUpperCase(),
    type: String(type || '2'),
    encoding: 'json', // injected by the app's auth interceptor (pg4)
  });

  return {
    cli: digits,
    targetUrl: `https://${cleanHost}.truecaller.com/v2/search?${params}`,
    headers: {
      Accept: String(accept || 'application/json').trim(),
      Authorization: `Bearer ${String(token ?? '').trim()}`,
    },
  };
}

/** Parse the ContactDto-shaped JSON: { data: [{ name, spamInfo, phones, ... }] }. */
export function parseResponse(raw) {
  const result = { names: [], spam_level: -1, spam_text: 'Unknown', entries: [] };
  const text = String(raw ?? '').trim();
  if (!text) {
    result.spam_text = 'No results';
    return result;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // The stock app asks for protobuf; without a decoder we can only preserve the raw body.
    result.spam_text = 'Non-JSON response (likely protobuf)';
    return result;
  }

  const contacts = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : data && typeof data === 'object'
        ? [data]
        : [];

  const names = [];
  let spamLevel = 0;
  for (const contact of contacts) {
    if (!contact || typeof contact !== 'object') continue;

    const name =
      contact.name || contact.transliteratedName || contact.altName || '';
    if (name && !names.includes(name)) names.push(name);

    const spamInfo = contact.spamInfo ?? {};
    const phone = Array.isArray(contact.phones) ? contact.phones[0] ?? {} : {};
    const spamScore = Number(spamInfo.spamScore ?? phone.spamScore ?? 0) || 0;
    const spamType = spamInfo.spamType ?? phone.spamType ?? '';
    const fraud = contact.isSuspectedFraud === true;

    if (spamScore > 0 || spamType) spamLevel = Math.max(spamLevel, 1);
    if (fraud) spamLevel = Math.max(spamLevel, 2);

    result.entries.push({
      name,
      type: String(spamType || contact.category || ''),
      suspicious_spam: fraud,
      spam_score: spamScore,
      e164: phone.e164Format ?? '',
    });
  }

  result.names = names;
  result.spam_level = spamLevel;
  result.spam_text = { 0: 'Not flagged', 1: 'Spam', 2: 'Suspicious spam' }[spamLevel] ?? 'Unknown';
  return result;
}

export async function lookup(payload) {
  const {
    number,
    dialCode,
    countryCode,
    token,
    host,
    type,
    accept,
    proxyTemplate = '',
  } = payload;

  if (!String(token ?? '').trim()) {
    throw new Error('Paste the Bearer token from your own signed-in TrueCaller app first.');
  }

  const { cli, targetUrl, headers } = buildRequest({
    number,
    dialCode,
    countryCode,
    token,
    host,
    type,
    accept,
  });
  const request = buildProxyRequest(targetUrl, headers, proxyTemplate);

  let response;
  try {
    response = await fetchText(request.url, { method: 'GET', headers: request.headers });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      url: request.url,
      targetUrl,
      cli,
      raw: '',
      proxied: request.proxied,
      names: [],
      spam_level: -1,
      spam_text: 'Unavailable',
      error: request.proxied
        ? `CORS proxy request failed: ${err.message}`
        : `Request blocked or failed: ${err.message}. TrueCaller sends a custom Authorization header, so a direct browser request is usually blocked — configure a CORS proxy below.`,
    };
  }

  const parsed = parseResponse(response.text);
  let error = '';
  if (!response.ok) {
    parsed.spam_level = -1;
    parsed.spam_text = 'Unavailable';
    if (response.status === 401 || response.status === 403) {
      error = 'TrueCaller rejected the token. Capture a fresh Bearer token from your signed-in app.';
    } else {
      error = `Upstream returned HTTP ${response.status}.`;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    url: request.url,
    targetUrl,
    cli,
    raw: response.text,
    proxied: request.proxied,
    error,
    ...parsed,
  };
}
