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

The UI is built with **shadcn/ui** (Tailwind v4, Radix, neutral base theme). The structure follows
the Stitch design refs in `caller_id_lookup_design.zip`.

1. In the **provider toggle group**, enable one or more of **Eyecon**, **TrueCaller**
   (both live-verified end-to-end). **NumVerify** is shown as a disabled placeholder for later.
2. Pick a country code (Bangladesh `+880` is the default) and type a number in **Phone number(s)**,
   e.g. `01632-027018`. A leading trunk `0` is stripped when the country code is added. You can
   also choose **Custom / full number** and paste `+880...` or `00880...` directly.
3. The input is a single merged field: enter one number, or several separated by commas/new lines,
   or load a `.csv` with the upload button. The count updates live and each number gets its own
   group of provider cards.
4. Choose **Caller ID** (name + spam level) or **Search / name history**, then click **Look up**
   (or **Look up all**). Results appear as one card per provider with names, spam badge, carrier
   and HTTP status. **Request URL & raw response** expands for debugging.
5. Open **Settings** to edit credentials and enable/disable providers. Eyecon needs your CID
   (`e-auth` / `clientId`); the `e-auth-c` checksum is computed automatically. TrueCaller needs the
   Bearer token — the account's **`installationId`** — which expires roughly **72 hours** after
   being fetched. Host (`search5`, `search5-eu`, `search5-noneu`), search `type` (`2` = caller ID)
   and `Accept` header are editable. The country select supplies the ISO2 `countryCode` (e.g. `BD`).

All settings and secrets live under the localStorage key `callerid-lookup:settings:v1`. Empty saved
values fall back to the env defaults so a stale browser entry cannot erase a working credential.

### Local credential defaults (`.env.local`)

Copy `app/.env.example` to `app/.env.local` and set:

```text
NEXT_PUBLIC_EYECON_CLIENT_ID=<your CID>
NEXT_PUBLIC_TRUECALLER_TOKEN=<your TrueCaller installationId>
```

These pre-fill the credential fields on first load. Anything you paste in the UI overrides them
and is saved to browser localStorage. **Next.js inlines `NEXT_PUBLIC_*` values into the public JS
bundle at build time** — only put dev/throwaway values there. Never commit `.env.local`; for a
production deployment leave these blank in Vercel and paste real credentials in the browser UI.

### TrueCaller request (live-verified)

```text
GET https://search5.truecaller.com/v2/search
    ?q=%2B<e164>&countryCode=<ISO2>&type=2&encoding=json
Accept: application/json
Authorization: Bearer <your token>
```

`Accept: application/json` works; `encoding=json` is added by the app's auth interceptor (`pg4`).
No HMAC/signature parameter exists on this path. The Bearer value is the account's
**installationId** (server-issued, 72-hour TTL — paste your own; never commit it). Both
`search5` and `search5-noneu` hosts work.

Live-verified response shape:
`{ data: [{ name, phones: [{ e164Format, carrier, ... }], feedback: { feedbackType },
isFraud, electedTags, ... }], provider, stats }`. Spam/fraud is in `feedback.feedbackType`
and `isFraud` (older `spamInfo` / `isSuspectedFraud` variants are also parsed).

Details: `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` and `TRUE_CALLER_ENDPOINTS.md`.

## CORS caveat (important)

Neither upstream sends CORS headers:

- `GET /app/getnames.jsp` with an `Origin` header returns HTTP 200 with the name data, but
  **no `Access-Control-Allow-Origin` response header**.
- The custom `e-auth-*` headers trigger a CORS preflight; `OPTIONS` returns **HTTP 401** with no
  CORS headers. TrueCaller's `OPTIONS` returns 403. Browsers therefore block a direct `fetch()`.

### Built-in same-origin relay (default)

`next.config.mjs` defines **rewrites only** (no API route, no server-held secrets):

| Browser calls | Upstream |
| --- | --- |
| `/p/eyecon/...` | `https://api.eyecon-app.com/...` |
| `/p/tc/...` | `https://search5.truecaller.com/...` |
| `/p/tc-eu/...` | `https://search5-eu.truecaller.com/...` |
| `/p/tc-noneu/...` | `https://search5-noneu.truecaller.com/...` |

`src/lib/providers/http.js` picks the right prefix automatically when the proxy field is blank.
The browser still sends the user's own CID/token in request headers, so the server holds no
secrets. **Eyecon is verified working through this relay (HTTP 200).**

> **TrueCaller caveat — SOLVED:** TrueCaller's WAF fingerprints the TLS client and rejects
> Node/OpenSSL (401/429). The built-in rewrite relay therefore only works for Eyecon. Deploy
> `relay-worker.js` to a free Cloudflare Worker and set `NEXT_PUBLIC_CORS_PROXY_TEMPLATE`
> (or the UI proxy field) to `https://<worker>.workers.dev/?url={url}&{headers}`. **Verified
> 2026-11-24:** both TrueCaller (`Tasif`) and Eyecon (`TAS IF?`) return HTTP 200 through it with
> `Access-Control-Allow-Origin: *`. See `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §10.

### Optional external proxy override

Open **Settings → Advanced → CORS proxy** to override the relay. Tokens:

| Token | Meaning |
| --- | --- |
| `{url}` | `encodeURIComponent()` of the full upstream URL |
| `{rawUrl}` | the full upstream URL unencoded |
| `{headers}` | upstream headers as repeated `reqHeaders=<encoded "Name: value">` params |

Examples:

```text
https://corsproxy.io/?key=YOUR_KEY&url={url}&{headers}
https://your-proxy.example.com/?url={url}
https://your-proxy.example.com/?{rawUrl}
```

Public free proxies tested in Nov 2026 were dead/paywalled (corsproxy.io now requires an API key).
`relay-worker.js` is a ready-to-deploy **free Cloudflare Worker** relay for TrueCaller if the
built-in rewrite fails on your host. Deploy it, then set the template to
`https://<your-worker>.workers.dev/?url={url}&{headers}`.
With no token the encoded URL is appended. With `{headers}`, the browser sends no custom headers
and the proxy sets them upstream, avoiding a preflight. A proxy that strips custom headers gets a
401 from the provider.

**Privacy:** a third-party proxy sees your CID/token and the phone numbers you look up. Use one you
control for anything sensitive. Blank = built-in relay.

## Provider architecture

- `src/lib/providers/eyecon.js` — working Eyecon request builder, checksum and response parser.
- `src/lib/providers/truecaller.js` — live-verified `/v2/search` provider; needs a user-pasted installationId.
- `src/lib/providers/index.js` — registry and `lookup(providerId, payload)` dispatcher.
- `src/lib/providers/http.js` — shared fetch/timeout and proxy-URL mapping helpers.
- `src/lib/settings.js` — country list, defaults and localStorage persistence (multi-provider,
  single/batch mode, credentials, proxy template).
- `src/app/page.js` — the `'use client'` UI (shadcn components from `src/components/ui/`).
- `src/app/globals.css` / `components.json` / `postcss.config.mjs` — Tailwind v4 + shadcn setup.

Both providers expose `SECRET_FIELDS` / `DEFAULT_SECRETS` and a single `lookup()`; the UI,
persistence and result rendering pick up new fields automatically. Verified request details for
both providers are in `truecaller_research/` and `HANDOFF.md`.
