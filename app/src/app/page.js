'use client';

import { useEffect, useState } from 'react';
import { PROVIDERS, getProvider, lookup } from '@/lib/providers';
import { authChecksum } from '@/lib/providers/eyecon';
import { COUNTRIES, loadSettings, saveSettings } from '@/lib/settings';

const styles = {
  main: { maxWidth: 880, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif', color: '#1c1e21' },
  sub: { color: '#57606a', fontSize: 14, lineHeight: 1.5 },
  card: { border: '1px solid #d0d7de', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem', background: '#fff' },
  h2: { fontSize: 16, margin: '0 0 0.75rem' },
  label: { display: 'grid', gap: '0.35rem', fontWeight: 600, fontSize: 14 },
  input: { padding: '0.5rem 0.6rem', border: '1px solid #d0d7de', borderRadius: 6, fontSize: 14, width: '100%', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  help: { color: '#57606a', fontSize: 12, fontWeight: 400, lineHeight: 1.5 },
  warn: { background: '#fff8c5', border: '1px solid #d4a72c', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: 13 },
  error: { background: '#ffebe9', border: '1px solid #ff8182', borderRadius: 6, padding: '0.75rem', color: '#cf222e', fontSize: 14, marginBottom: '1rem' },
  button: { padding: '0.6rem 1.2rem', border: 0, borderRadius: 6, background: '#0969da', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: 6, padding: '0.6rem', fontSize: 12, maxHeight: 220, overflow: 'auto' },
  th: { textAlign: 'left', borderBottom: '1px solid #d0d7de', padding: '0.35rem 0.6rem 0.35rem 0', fontSize: 12, color: '#57606a' },
  td: { borderBottom: '1px solid #eaeef2', padding: '0.35rem 0.6rem 0.35rem 0', fontSize: 13 },
};

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (settings) saveSettings(settings);
  }, [settings]);

  if (!settings) return <main style={styles.main}><p>Loading…</p></main>;

  const provider = getProvider(settings.provider);
  const secretValues = settings.secrets[provider.id] ?? {};
  const selectedCountry = COUNTRIES.find((country) => country.code === settings.dialCode);

  function patch(patchObject) {
    setSettings((prev) => ({ ...prev, ...patchObject }));
  }

  function patchSecret(key, value) {
    setSettings((prev) => ({
      ...prev,
      secrets: {
        ...prev.secrets,
        [provider.id]: { ...(prev.secrets[provider.id] ?? {}), [key]: value },
      },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await lookup(provider.id, {
        number: settings.number,
        dialCode: settings.dialCode,
        countryCode: selectedCountry?.iso ?? '',
        cid: settings.secrets.eyecon?.cid,
        token: settings.secrets.truecaller?.token,
        host: settings.secrets.truecaller?.host,
        type: settings.secrets.truecaller?.type,
        accept: settings.secrets.truecaller?.accept,
        mode: settings.mode,
        lang: settings.lang,
        source: settings.source,
        proxyTemplate: settings.proxyTemplate,
      });
      setResult(data);
      if (!data.ok && data.error) setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <h1>Caller ID lookup</h1>
      <p style={styles.sub}>
        Client-only Next.js app: requests go straight from your browser to the provider. Secrets are kept in
        this browser&apos;s localStorage — there are no Next.js API routes. If a lookup is blocked by CORS,
        open <strong>Advanced — CORS proxy</strong> and configure a proxy URL template.
      </p>

      <form onSubmit={submit}>
        <section style={styles.card}>
          <h2 style={styles.h2}>1. Provider</h2>
          <label style={styles.label}>
            Provider
            <select
              value={settings.provider}
              onChange={(event) => patch({ provider: event.target.value })}
              style={styles.input}
            >
              {PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.placeholder ? ' (not configured yet)' : ''}
                </option>
              ))}
            </select>
          </label>
          {provider.placeholder && (
            <p style={{ ...styles.warn, marginBottom: 0 }}>
              {provider.name} is a placeholder. Provider research is still in progress; no lookup is available yet.
            </p>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>2. Number</h2>
          <div style={styles.row}>
            <label style={{ ...styles.label, flex: '0 0 230px' }}>
              Country code
              <select
                value={settings.dialCode}
                onChange={(event) => patch({ dialCode: event.target.value })}
                style={styles.input}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code || 'custom'} value={country.code}>{country.label}</option>
                ))}
              </select>
            </label>
            <label style={{ ...styles.label, flex: '1 1 240px' }}>
              Mobile number
              <input
                value={settings.number}
                onChange={(event) => patch({ number: event.target.value })}
                placeholder={selectedCountry?.placeholder ?? '01XXX-XXXXXX'}
                inputMode="tel"
                style={styles.input}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.9rem', fontSize: 14 }}>
            <label>
              <input
                type="radio"
                checked={settings.mode === 'callerid'}
                onChange={() => patch({ mode: 'callerid' })}
              />{' '}
              Caller ID
            </label>
            <label>
              <input
                type="radio"
                checked={settings.mode === 'search'}
                onChange={() => patch({ mode: 'search' })}
              />{' '}
              Search / name history
            </label>
          </div>
        </section>

        {!provider.placeholder && (
          <section style={styles.card}>
            <h2 style={styles.h2}>3. Credentials</h2>
            {provider.SECRET_FIELDS.map((field) => (
              <label key={field.key} style={{ ...styles.label, marginBottom: '0.75rem' }}>
                {field.label}
                <input
                  value={secretValues[field.key] ?? ''}
                  onChange={(event) => patchSecret(field.key, event.target.value)}
                  placeholder={provider.DEFAULT_SECRETS?.[field.key] ?? ''}
                  autoComplete="off"
                  spellCheck={false}
                  style={styles.input}
                />
                <small style={styles.help}>{field.help}</small>
              </label>
            ))}
            {provider.id === 'eyecon' && (
              <p style={{ ...styles.help, marginBottom: 0 }}>
                Computed <code>e-auth-c</code> checksum: <strong>{authChecksum(secretValues.cid)}</strong>
              </p>
            )}
          </section>
        )}

        <details style={styles.card}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Advanced — CORS proxy</summary>
          <p style={styles.help}>
            <code>api.eyecon-app.com</code> sends no <code>Access-Control-Allow-Origin</code> header, and the
            custom <code>e-auth-*</code> headers trigger a preflight that returns 401. So a direct browser
            lookup is normally blocked. If it fails, point this at a CORS proxy you control or trust.
          </p>
          <label style={styles.label}>
            Proxy URL template (blank = direct)
            <input
              value={settings.proxyTemplate}
              onChange={(event) => patch({ proxyTemplate: event.target.value })}
              placeholder="https://corsproxy.io/?url={url}&{headers}"
              autoComplete="off"
              spellCheck={false}
              style={styles.input}
            />
          </label>
          <p style={styles.help}>
            Tokens: <code>{'{url}'}</code> = encoded target URL, <code>{'{rawUrl}'}</code> = raw URL,{' '}
            <code>{'{headers}'}</code> = upstream headers as <code>reqHeaders=...</code> params (corsproxy.io
            style, avoids a preflight). With no token, the encoded URL is appended to the template.
            <strong> Privacy:</strong> a third-party proxy will see your CID and phone number.
          </p>
        </details>

        <button type="submit" disabled={loading || provider.placeholder} style={styles.button}>
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {error && <p style={{ ...styles.error, marginTop: '1rem' }}>{error}</p>}

      {result && (
        <section style={{ ...styles.card, marginTop: '1rem' }}>
          <h2 style={styles.h2}>Result</h2>
          <p style={{ fontSize: 14, margin: '0.25rem 0' }}><strong>Number:</strong> {result.cli}</p>
          <p style={{ fontSize: 14, margin: '0.25rem 0' }}>
            <strong>Status:</strong> HTTP {result.status} — {result.spam_text}
            {result.proxied ? ' (via proxy)' : ''}
          </p>
          <p style={{ fontSize: 14, margin: '0.25rem 0' }}>
            <strong>Names:</strong> {result.names?.length ? result.names.join(', ') : '(none)'}
          </p>

          {result.entries?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Suspicious spam</th>
                </tr>
              </thead>
              <tbody>
                {result.entries.map((entry, index) => (
                  <tr key={`${entry.name}-${index}`}>
                    <td style={styles.td}>{entry.name || '—'}</td>
                    <td style={styles.td}>{entry.type || '—'}</td>
                    <td style={styles.td}>{entry.suspicious_spam ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ ...styles.help, marginTop: '1rem' }}><strong>Request URL:</strong></p>
          <pre style={styles.pre}>{result.url}</pre>
          <p style={styles.help}><strong>Raw response:</strong></p>
          <pre style={styles.pre}>{result.raw || '(empty)'}</pre>
        </section>
      )}
    </main>
  );
}
