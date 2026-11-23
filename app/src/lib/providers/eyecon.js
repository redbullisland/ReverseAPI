// Eyecon name / spam lookup. Runs entirely in the browser.
import { buildProxyRequest, fetchText } from './http';

export const id = 'eyecon';
export const name = 'Eyecon';
export const placeholder = false;

export const DEFAULT_CID = '976f3b43-253a-48fa-a49a-d76be98e3d88';

export const SECRET_FIELDS = [
  {
    key: 'cid',
    label: 'Client ID (e-auth / CID)',
    help: 'Paste the clientId from your own signed-in Eyecon app. Stored only in this browser.',
  },
];

export const DEFAULT_SECRETS = { cid: DEFAULT_CID };

const BASE_URL = 'https://api.eyecon-app.com/app/getnames.jsp';
const APSVERSION = 'vc_785_vn_4.2026.08.27.2228_a';
const AUTH_KEY = 'PgdtSBeR0MumR7fO'; // NetworkHelper.java:42
const DEFAULT_SOURCE = 'callerid-web';

/** Build an E.164-style digit string without the leading "+". */
export function normalizeNumber(raw, dialCode = '+880') {
  const value = String(raw ?? '').trim();
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('Enter a phone number.');

  // A number written as +... or 00... already contains its country code.
  if (value.startsWith('+')) return digits;
  if (value.startsWith('00')) return digits.replace(/^00/, '');

  const dialDigits = String(dialCode ?? '').replace(/\D/g, '');
  if (!dialDigits || digits.startsWith(dialDigits)) return digits;

  // National numbers commonly start with a trunk 0 that E.164 drops.
  return dialDigits + digits.replace(/^0+/, '');
}

// NetworkHelper.m15849f(): sum of Character.getNumericValue(first char) per CID segment.
export function authChecksum(cid) {
  let total = 0;
  for (const part of String(cid ?? '').split('-')) {
    if (!part) continue;
    const ch = part[0];
    if (/[0-9]/.test(ch)) total += Number(ch);
    else if (/[a-f]/i.test(ch)) total += 10 + ch.toLowerCase().charCodeAt(0) - 97;
  }
  return String(total);
}

export function buildRequest({ number, dialCode, cid, mode, lang, source }) {
  const cli = normalizeNumber(number, dialCode);
  const params = new URLSearchParams({
    cli,
    lang: lang || 'en',
    is_callerid: mode === 'callerid' ? 'true' : 'false',
    is_ic: 'false',
    apsversion: APSVERSION,
    requestApi: mode === 'callerid' ? 'okHttp' : 'URLconnection',
    source: source || DEFAULT_SOURCE,
  });
  if (mode === 'search') params.set('is_search', 'true');

  return {
    cli,
    targetUrl: `${BASE_URL}?${params}`,
    headers: {
      accept: 'application/json',
      'e-auth-v': 'e1',
      'e-auth': String(cid ?? '').trim(),
      'e-auth-c': authChecksum(cid),
      'e-auth-k': AUTH_KEY,
    },
  };
}

export function parseResponse(raw) {
  const result = { names: [], spam_level: -1, spam_text: 'Unknown', entries: [] };
  const text = String(raw ?? '');
  let data;

  try {
    data = text.trim() ? JSON.parse(text) : [];
  } catch {
    // Eyecon sometimes returns a bare name string instead of JSON.
    const name = text.trim();
    if (name) {
      result.names = [name];
      result.entries = [{ name, type: '', suspicious_spam: false }];
    }
    result.spam_text = 'Plain-text response';
    return result;
  }

  if (!Array.isArray(data)) data = data && typeof data === 'object' ? [data] : [];

  const names = [];
  let spamLevel = 0;
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const name = item.name;
    if (typeof name === 'string' && name.trim()) {
      const clean = name.trim();
      if (!['spam', 'maybe spam'].includes(clean.toLowerCase()) && !names.includes(clean)) {
        names.push(clean);
      }
    }
    let kind = '';
    for (const key of ['type', 'class', '@type', 'classDiscriminator']) {
      if (key in item) {
        kind = String(item[key] ?? '').toLowerCase();
        break;
      }
    }
    const suspicious = item.suspicious_spam === true;
    if (kind === 'spam' || kind.includes('maybe')) spamLevel = Math.max(spamLevel, 1);
    if (suspicious) spamLevel = Math.max(spamLevel, 2);
    result.entries.push({ name, type: kind, suspicious_spam: suspicious });
  }

  result.names = names;
  result.spam_level = spamLevel;
  result.spam_text = { 0: 'Not flagged', 1: 'Spam', 2: 'Suspicious spam' }[spamLevel] ?? 'Unknown';
  return result;
}

export async function lookup({
  number,
  dialCode,
  cid,
  mode = 'callerid',
  lang = 'en',
  source = DEFAULT_SOURCE,
  proxyTemplate = '',
}) {
  const cleanCid = String(cid ?? '').trim() || DEFAULT_CID;
  if (!['callerid', 'search'].includes(mode)) throw new Error('Invalid lookup mode.');

  const { cli, targetUrl, headers } = buildRequest({
    number,
    dialCode,
    cid: cleanCid,
    mode,
    lang,
    source,
  });
  const request = buildProxyRequest(targetUrl, headers, proxyTemplate);

  try {
    const response = await fetchText(request.url, { method: 'GET', headers: request.headers });
    const parsed = parseResponse(response.text);
    let error = '';

    if (!response.ok) {
      parsed.spam_level = -1;
      parsed.spam_text = 'Unavailable';
      if (response.status === 401) {
        error = 'Eyecon rejected the CID (401). Use the clientId from your own signed-in Eyecon app.';
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
        : `Request blocked or failed: ${err.message}. Eyecon does not send CORS headers, so direct browser requests usually fail — configure a CORS proxy below.`,
    };
  }
}
