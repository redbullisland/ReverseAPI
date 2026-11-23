import { useState } from 'react';

const COUNTRIES = [
  { code: '+880', label: 'Bangladesh (+880)', placeholder: '17XXXXXXXX' },
  { code: '+91', label: 'India (+91)', placeholder: 'XXXXXXXXXX' },
  { code: '+92', label: 'Pakistan (+92)', placeholder: '3XXXXXXXXX' },
  { code: '+977', label: 'Nepal (+977)', placeholder: '9XXXXXXXXX' },
  { code: '+94', label: 'Sri Lanka (+94)', placeholder: '7XXXXXXXX' },
  { code: '+1', label: 'USA / Canada (+1)', placeholder: 'XXXXXXXXXX' },
  { code: '+44', label: 'UK (+44)', placeholder: '7XXXXXXXXX' },
  { code: '+61', label: 'Australia (+61)', placeholder: '4XXXXXXXXX' },
  { code: '+971', label: 'UAE (+971)', placeholder: '5XXXXXXXX' },
  { code: '+966', label: 'Saudi Arabia (+966)', placeholder: '5XXXXXXXX' },
  { code: '', label: 'Custom / full number', placeholder: '+880 17XX XXX XXX' },
];

export default function App() {
  const [dial, setDial] = useState('+880');
  const [local, setLocal] = useState('');
  const [cid, setCid] = useState(() => localStorage.getItem('eyecon_cid') || '976f3b43-253a-48fa-a49a-d76be98e3d88');
  const [mode, setMode] = useState('callerid');
  const [lang, setLang] = useState('en');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selected = COUNTRIES.find((c) => c.code === dial) ?? COUNTRIES[COUNTRIES.length - 1];

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    let localDigits = local.replace(/\D/g, '');
    const dialDigits = dial.replace(/\D/g, '');
    let number;
    if (!dialDigits) {
      number = localDigits;
    } else if (localDigits.startsWith(dialDigits)) {
      number = localDigits;
    } else {
      // Bangladeshi (and many other) national numbers start with a trunk 0;
      // international E.164 drops it after the country code.
      localDigits = localDigits.replace(/^0+/, '');
      number = dialDigits + localDigits;
    }

    localStorage.setItem('eyecon_cid', cid);
    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, cid, mode, lang, source: 'vite-react' }),
      });
      const data = await response.json();
      setResult(data);
      if (!data.ok && data.error) setError(data.error);
    } catch (err) {
      setError(`Could not reach the local server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Eyecon number lookup</h1>
      <p className="sub">
        Local UI for <code>GET /app/getnames.jsp</code> — name + spam, and name history.
        Requests go from this machine directly to <code>api.eyecon-app.com</code>.
      </p>

      <form className="card" onSubmit={submit}>
        <div className="number-row">
          <div>
            <label htmlFor="dial">Country code</label>
            <select id="dial" value={dial} onChange={(e) => setDial(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code || 'custom'} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="local">Mobile number</label>
            <input
              id="local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder={selected.placeholder}
              autoComplete="off"
              required
            />
          </div>
        </div>

        <label htmlFor="cid">Client ID / <code>e-auth</code> from your Eyecon app</label>
        <input
          id="cid"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          autoComplete="off"
          required
        />

        <div className="two-col">
          <div>
            <label htmlFor="mode">Mode</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="callerid">Caller ID (name + spam)</option>
              <option value="search">Search (all known names)</option>
            </select>
          </div>
          <div>
            <label htmlFor="lang">Language</label>
            <input id="lang" value={lang} onChange={(e) => setLang(e.target.value)} />
          </div>
        </div>

        <button type="submit" disabled={loading}>{loading ? 'Looking up…' : 'Look up'}</button>
      </form>

      {error && <div className="card error">{error}</div>}

      {result && (
        <div className="card">
          <div>
            <span className={`badge ${result.status === 200 ? 'ok' : 'bad'}`}>
              HTTP {result.status}
            </span>{' '}
            <span className="muted">cli={result.cli}</span>
          </div>
          <h3>Names</h3>
          <ul>
            {(result.names ?? []).length ? (
              result.names.map((name) => <li key={name}>{name}</li>)
            ) : (
              <li className="muted">No names returned</li>
            )}
          </ul>
          <div>
            Spam status:{' '}
            <span className={`badge ${result.spam_level === 2 ? 'warn' : result.spam_level === 1 ? 'bad' : 'ok'}`}>
              {result.spam_text}
            </span>
          </div>
          <h3>Request URL</h3>
          <code>{result.url}</code>
          <h3>Raw response</h3>
          <pre>{result.raw}</pre>
        </div>
      )}

      <details className="card">
        <summary>Where do I get the Client ID?</summary>
        <p>
          The server rejects unknown IDs with <code>401</code>. The app receives it from
          <code> social_auth/use_cli_validation</code> after phone verification and stores it
          as the <code>clientId</code> preference, then sends it as <code>e-auth</code>.
        </p>
        <ul>
          <li>Capture a real request with mitmproxy/Charles and copy the <code>e-auth</code> header.</li>
          <li>On a rooted device/emulator, read <code>clientId</code> from the app's <code>shared_prefs</code>.</li>
          <li>Hook <code>Authenticator.m16803d()</code> with Frida and print its return value.</li>
        </ul>
        <p>The <code>e-auth-c</code> checksum and <code>e-auth-k</code> key are generated automatically.</p>
      </details>
    </>
  );
}
