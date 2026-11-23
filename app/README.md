# Caller ID Lookup (client-only Next.js)

Browser-only caller-ID / spam lookup UI for Eyecon and TrueCaller.
There are **no Next.js API routes**: every lookup is a `fetch()` made directly from the user's
browser. Secrets are pasted in the UI and saved in that browser's `localStorage`.

## Vercel setup

- **Root Directory:** `app`
- Framework preset: Next.js (auto-detected)
- Build command: `npm run build` (default)
- No environment variables are required or used for lookups.

## Local dev

```bat
cd D:\ReverseAPI\app
npm install
npm run dev
```

Open http://localhost:3000. Verify a production build with `npm run build`.

## UI walkthrough

1. Pick a provider: **Eyecon** (live-verified) or **TrueCaller** (built from static analysis — request shape is a candidate, not yet live-verified).
2. Pick a country code (Bangladesh `+880` is the default) and type a number, e.g. `01632-027018`.
   A leading trunk `0` is stripped when the country code is added. You can also choose
   **Custom / full number** and paste `+880...` or `00880...` directly.
3. Choose **Caller ID** (name + spam level) or **Search / name history**.
4. Paste your own Eyecon CID (`e-auth` / `clientId`) in the Credentials section. A working CID
   is pre-filled as a convenience default, but it is fully editable and persists in localStorage.
   The `e-auth-c` checksum is computed automatically.
5. For **TrueCaller**, paste the Bearer token from your own signed-in app. The host (`search5`,
   `search5-eu`, `search5-noneu`), search `type` (`2` = caller ID) and `Accept` header are editable
   because the exact combination still needs live confirmation. The country code select supplies
   the ISO2 `countryCode` parameter (e.g. `BD`).
6. Click **Look up**. Names, spam flags, the request URL and the raw response are shown below.

All settings and secrets live under the localStorage key `callerid-lookup:settings:v1`.

### TrueCaller request (static-derived)

```text
GET https://search5.truecaller.com/v2/search
    ?q=%2B<e164>&countryCode=<ISO2>&type=2&encoding=json
Accept: application/json
Authorization: Bearer <your token>
```

The stock app sends `Accept: application/x-protobuf` and adds `encoding=json` via an auth
interceptor (`pg4`). No HMAC/signature parameter was found on this path. Response is parsed as
`{ data: [{ name, altName, spamInfo: { spamScore, spamType }, phones: [...] }] }`. Details and
open questions: `truecaller_research/TRUE_CALLER_ENDPOINTS.md` and `DYNAMIC_PLAN.md`.

## CORS caveat (important)

Eyecon does not allow browser cross-origin access (TrueCaller sends a custom `Authorization`
header, so the same preflight concern applies):

- `GET /app/getnames.jsp` with an `Origin` header returns HTTP 200 with the name data, but
  **no `Access-Control-Allow-Origin` response header**.
- The custom `e-auth-*` headers trigger a CORS preflight; `OPTIONS` returns **HTTP 401** with no
  CORS headers. Browsers therefore block the direct `fetch()` even though the same request works
  from `curl` or a server-side proxy.

This is inherent to a client-only app. To work around it, expand **Advanced — CORS proxy** in the
UI and set a proxy URL template (also stored in localStorage). Tokens:

| Token | Meaning |
| --- | --- |
| `{url}` | `encodeURIComponent()` of the full upstream URL |
| `{rawUrl}` | the full upstream URL unencoded |
| `{headers}` | upstream headers as repeated `reqHeaders=<encoded "Name: value">` params (corsproxy.io style) |

Examples:

```text
https://corsproxy.io/?key=YOUR_KEY&url={url}&{headers}
https://your-proxy.example.com/?url={url}
https://your-proxy.example.com/?{rawUrl}
```

With no token, the encoded URL is simply appended (prefix style). When `{headers}` is present,
the browser does not send the `e-auth-*` / `Authorization` headers itself — the proxy sets them
upstream — so no preflight is needed. A proxy that strips or ignores custom headers will get a
401 from the provider.

**Privacy:** a third-party proxy sees your CID/token and the phone numbers you look up. Use a proxy you
control for anything sensitive. Leaving the field blank keeps requests direct (and likely CORS-blocked).

## Provider architecture

- `src/lib/providers/eyecon.js` — working Eyecon request builder, checksum and response parser.
- `src/lib/providers/truecaller.js` — static-derived `/v2/search` provider; needs a user-pasted Bearer token.
- `src/lib/providers/index.js` — registry and `lookup(providerId, payload)` dispatcher.
- `src/lib/providers/http.js` — shared fetch/timeout and proxy-URL mapping helpers.
- `src/lib/settings.js` — country list, defaults and localStorage persistence.
- `src/app/page.js` — the `'use client'` UI.

Both providers expose `SECRET_FIELDS` / `DEFAULT_SECRETS` and a single `lookup()`; the UI,
persistence and result rendering pick up new fields automatically. Verified request details for
Eyecon are in `HANDOFF.md`; TrueCaller's static candidate is in `truecaller_research/`.
