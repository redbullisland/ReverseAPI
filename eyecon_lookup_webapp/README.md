# Eyecon `getnames.jsp` local lookup UI

A dependency-free web page for testing the two `getnames.jsp` variants recovered from the APK:

- **Caller ID** — `cli=<number>&is_callerid=true&is_search=false` → name + spam flags
- **Search** — `cli=<number>&is_callerid=false&is_search=true` → all known names

## Run

```powershell
cd D:\ReverseAPI\eyecon_lookup_webapp
python server.py
```

Open <http://127.0.0.1:8765>. The server binds only to localhost and uses Python's standard library.

## Use

1. Enter the number **with country code**, e.g. `+1 415 555 2671` (normalized to `14155552671`).
2. Paste the `clientId` from your own Eyecon installation into **Client ID**.
3. Pick a mode and click **Look up**.
4. The page shows the extracted names, spam status, the exact request URL, and the raw JSON.

The Client ID is stored in your browser's `localStorage`; it is not sent anywhere except `api.eyecon-app.com`. The `e-auth-c` checksum and `e-auth-k` key are generated automatically.

## About the Client ID

An unauthenticated request returns `401`, and a made-up CID also returns `401` — the server validates it. The app stores the server-issued value as the `clientId` preference after phone verification and sends it as the `e-auth` header (`NetworkHelper.java:330-339`):

```text
e-auth-v: e1
e-auth: <clientId>
e-auth-c: <sum of first char of each hyphen-separated part>
e-auth-k: PgdtSBeR0MumR7fO
```

Ways to obtain your own:

- Capture a request from the app with mitmproxy/Charles and copy `e-auth`.
- Read `shared_prefs` for `clientId` on a rooted device/emulator.
- Hook `Authenticator.m16803d()` with Frida (`com.eyecon.global.Registration.Authenticator`).

## Files

- `server.py` — local HTTP server + API client + response parser
- `index.html` — the UI
