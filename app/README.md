# Caller ID Lookup (client-only Next.js)

Browser-only caller-ID / spam lookup UI for Eyecon and TrueCaller.
There are **no Next.js API routes**: every lookup is a `fetch()` made directly from the user's
browser. Secrets are pasted in the UI and saved in that browser's `localStorage`.

## Deployment — Cloudflare Pages (current)

Live: **https://callerid-lookup.pages.dev**

The site is a **static export**: no Next.js server runtime, no API routes, and no credentials in
the bundle. Cloudflare Pages serves `out/` as plain files; the Cloudflare Worker supplies CORS.

From `D:\ReverseAPI\app` in Git Bash (temporarily hide `.env.local` so no local secrets are inlined):

```bash
mv .env.local .env.local.bak
STATIC_EXPORT=1 \
  NEXT_PUBLIC_CORS_PROXY_TEMPLATE='https://callerid-relay.everse.workers.dev/?url={url}&{headers}' \
  npm run build
mv .env.local.bak .env.local
wrangler pages deploy out --project-name callerid-lookup --branch main
```

`STATIC_EXPORT=1` switches `next.config.mjs` from local dev rewrites to `output: 'export'`. If the
Pages project ever needs recreating, use `wrangler pages project create callerid-lookup
--production-branch main --force` — without `--force`, Wrangler delegates to Workers/OpenNext and
runs an unwanted server build. Do not add a `wrangler.jsonc` to this app; Pages will try to use it.

Vercel would also work (Root Directory `app`), but offers no benefit here: the app needs no server
features and TrueCaller still depends on the external worker.

## Local dev

```bat
cd D:\ReverseAPI\app
npm install
npm run dev
```

Open http://localhost:3000. Verify a production build with `npm run build`.

## UI walkthrough

The UI is built with **shadcn/ui** (Tailwind v4 + Radix) and a square-cornered, names-first design
based on the Stitch design refs in `caller_id_lookup_design.zip`.

1. If a source needs credentials, a single status strip at the top says exactly which value to add
   and offers **Open Settings**. The **Settings** button in the header opens the same dialog.
2. In **Sources**, keep one or more providers enabled — **Eyecon**, **TrueCaller**, or both
   (both live-verified end-to-end). Active sources show a checkmark.
3. Pick a country code (Bangladesh `+880` is the default) and type a number in **Phone numbers**,
   e.g. `01632-027018`. A leading trunk `0` is stripped when the country code is added. You can
   also choose **Custom / full number** and paste `+880...` or `00880...` directly.
4. The input is a single merged field: enter one number, or several separated by commas/new lines,
   or load a `.csv` with **Upload .csv**. The count beside **Mode** updates live ("No numbers yet"
   when empty), and each number gets its own result panel.
5. Choose **Caller ID** (current caller) or **Name history** (past names), then click **Look up**.
   Results are **names-first**: one bordered panel per number, with the highest-ranked name large
   and smaller source chips showing which provider supplied each name. HTTP/proxy/mode noise stays
   out of the main view; a spam warning only appears when a source actually flags one. Raw
   request/response is collapsed under **Technical details**.
6. In **Settings**, paste credentials for the providers you enabled, then **Save settings**. Eyecon
   needs your CID (`e-auth` / `clientId`); the `e-auth-c` checksum is computed automatically.
   TrueCaller needs the Bearer token — the account's **`installationId`** — which expires roughly
   **72 hours** after being fetched. Host (`search5`, `search5-eu`, `search5-noneu`), search `type`
   (`2` = caller ID) and `Accept` header are editable under **Advanced · relay / CORS proxy**.
   The country select supplies the ISO2 `countryCode` (e.g. `BD`).

All settings and secrets live under the localStorage key `callerid-lookup:settings:v1`. Empty saved
values fall back to the env defaults so a stale browser entry cannot erase a working credential.
**No working credentials are compiled into the deployed site** — visitors paste their own once in
Settings and that browser remembers them.

### Local credential defaults (`.env.local`)

Copy `app/.env.example` to `app/.env.local` and set:

```text
NEXT_PUBLIC_EYECON_CLIENT_ID=<your CID>
NEXT_PUBLIC_TRUECALLER_TOKEN=<your TrueCaller installationId>
NEXT_PUBLIC_CORS_PROXY_TEMPLATE=https://callerid-relay.everse.workers.dev/?url={url}&{headers}
```

These pre-fill the credential fields on first load for local development only. **Next.js inlines
`NEXT_PUBLIC_*` values into the public JS bundle at build time**, so the Cloudflare Pages build is
made with `.env.local` removed and only the public relay URL supplied. Never commit `.env.local`.

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
