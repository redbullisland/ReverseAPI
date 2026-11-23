# Eyecon `getnames.jsp` lookup — Vite + React

Small local UI for the two `getnames.jsp` variants:

- **Caller ID** — `cli=<number>&is_callerid=true` → name + spam flags
- **Search** — `cli=<number>&is_callerid=false&is_search=true` → all known names

The country-code dropdown defaults to **Bangladesh (+880)**.

## Run

```powershell
cd D:\ReverseAPI\eyecon_lookup_react
npm install
npm run dev
```

Open <http://127.0.0.1:5173>.

`npm run build` produces a static bundle in `dist/`. `npm run preview` serves that bundle on port 4173 with the same API route.

## No Python server needed

The browser cannot call Eyecon directly (CORS + custom `e-auth` headers), so the API route is handled by a small Vite middleware plugin in `vite.config.js`, backed by `api/eyecon.js`. It runs in both `dev` and `preview`. If you later deploy the static bundle to a host, you will need a serverless function or proxy for `/api/lookup`.

## Client ID

A made-up Client ID returns `401`. The app does **not** construct it locally: `RunnableC8496f.java:175-186` calls `social_auth/use_cli_validation` with `device_id` (Android ID), `cli`, and `advid`; the server's response string is stored as the `clientId` preference (`PhoneNumberValidationActivity.java:615-621`) and sent as `e-auth` (`NetworkHelper.java:330-339`). So the ID is server-issued after phone verification and cannot be derived offline.

Get yours from your own install:

- capture a request with mitmproxy/Charles and copy `e-auth`,
- read `clientId` from `shared_prefs` on a rooted device/emulator,
- hook `Authenticator.m16803d()` with Frida.

`e-auth-c` and `e-auth-k` are computed automatically by the app.

## Files

- `src/App.jsx` — UI, including the +880-default country dropdown
- `api/eyecon.js` — request builder, auth checksum, response parser
- `vite.config.js` — Vite plugin exposing `/api/lookup` in dev and preview
