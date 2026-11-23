// Shared by Vite's dev server and preview server. Keeps the browser away from
// Eyecon's CORS policy and the custom e-auth headers.

const BASE_URL = 'https://api.eyecon-app.com/app/getnames.jsp';
const APSVERSION = 'vc_785_vn_4.2026.08.27.2228_a';
const AUTH_KEY = 'PgdtSBeR0MumR7fO'; // NetworkHelper.java:42
const USER_AGENT = 'okhttp/4.12.0';

export function normalizeNumber(raw) {
  let value = String(raw ?? '').trim();
  if (value.startsWith('00')) value = '+' + value.slice(2);
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('Enter a phone number including its country code.');
  return digits;
}

// NetworkHelper.m15849f(): sum of the first character of each hyphen segment.
export function authChecksum(cid) {
  let total = 0;
  for (const part of cid.split('-')) {
    if (!part) continue;
    const ch = part[0];
    if (/[0-9]/.test(ch)) total += Number(ch);
    else if (/[a-f]/i.test(ch)) total += 10 + ch.toLowerCase().charCodeAt(0) - 97;
  }
  return String(total);
}

function buildUrl(cli, mode, lang, source) {
  const params = new URLSearchParams({
    cli,
    lang: lang || 'en',
    is_callerid: mode === 'callerid' ? 'true' : 'false',
    is_ic: 'false',
    apsversion: APSVERSION,
    requestApi: mode === 'callerid' ? 'okHttp' : 'URLconnection',
    source: source || 'local-webapp',
  });
  if (mode === 'search') params.set('is_search', 'true');
  return `${BASE_URL}?${params}`;
}

function parseResponse(raw) {
  const result = { names: [], spam_level: -1, spam_text: 'Unknown', entries: [] };
  let data;
  try {
    data = raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    result.spam_text = `Unparseable response: ${err.message}`;
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

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function handleLookup(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const cid = String(payload.cid ?? '').trim();
    const mode = String(payload.mode ?? 'callerid');
    if (!cid) throw new Error('Client ID (e-auth / clientId) is required');
    if (!['callerid', 'search'].includes(mode)) throw new Error('Invalid mode');

    const cli = normalizeNumber(payload.number);
    const url = buildUrl(cli, mode, payload.lang, payload.source);
    const headers = {
      'User-Agent': USER_AGENT,
      accept: 'application/json',
      'accept-charset': 'UTF-8',
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      'e-auth-v': 'e1',
      'e-auth': cid,
      'e-auth-c': authChecksum(cid),
      'e-auth-k': AUTH_KEY,
    };

    let status;
    let raw;
    try {
      const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      status = upstream.status;
      raw = await upstream.text();
    } catch (err) {
      send(res, 200, { ok: false, error: `Network error: ${err.message}`, url, cli });
      return;
    }

    const parsed = parseResponse(raw);
    if (status !== 200) {
      parsed.spam_level = -1;
      parsed.spam_text = 'Unavailable';
    }
    if (status === 401) {
      parsed.error = '401 from Eyecon: the Client ID was rejected. Use the clientId from your own signed-in Eyecon app/device.';
    }
    send(res, 200, { ok: status === 200, status, url, cli, raw, ...parsed });
  } catch (err) {
    send(res, 400, { ok: false, error: err.message });
  }
}
