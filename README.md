# ReverseAPI

Reverse-engineering research for caller-ID / spam-lookup Android apps, and a web
frontend that reproduces their name + spam lookups.

**Repo root:** `D:\ReverseAPI`
**Research status:** Eyecon and TrueCaller both complete and live-verified end-to-end.

---

## Layout

| Path | Tracked? | Purpose |
| --- | --- | --- |
| `HANDOFF.md` | yes | Research handoff / full history and final status |
| `EYECON_ENDPOINTS.md` | yes | Eyecon endpoint, auth, checksum, and response-field report |
| `AGENTS.md` | yes | Instructions for AI agents working in this repo |
| `GIT_WORKFLOW.md` | yes | Branch/commit rules, tracked vs ignored, module onboarding |
| `cid.txt` | yes | The real server-issued Eyecon CID (checksum `38`) |
| `*.ps1`, `*.bat` | yes | Emulator / capture helper scripts |
| `eyecon_hook*.js` | yes | Frida hook scripts used for dynamic analysis |
| `eyecon_lookup_react/` | yes | Working Vite+React webapp (reference; CID pre-filled) |
| `eyecon_lookup_webapp/` | yes | Original plain Python/HTML prototype (reference) |
| `app/` | yes | **Client-only Next.js app deployed to Cloudflare Pages** (no API routes) |
| `truecaller_research/` | yes | TrueCaller notes, plan, and grep results |
| `.env*`, `.vercel/`, `.wrangler/` | no | Local secrets and deploy metadata (gitignored) |
| `Eyecon... [FileCR].apk`, `Truecaller... [FileCR].apk` | no | Source APKs (keep on disk, gitignored) |
| `eyecon_apktool/`, `eyecon_jadx*/` | no | Decompiled trees (regenerate; see below) |
| `frida-*`, `*.msi`, `*.xz`, `*.zip` | no | Downloaded tools/binaries (gitignored) |
| `contactdb*.db`, `logcat_*.txt` | no | Captured runtime data (gitignored) |

> Large binaries, APKs, decompiled trees, and runtime dumps are **not** committed.
> They remain on disk. Use the commands below to regenerate them after a fresh clone.
> Branch/commit rules and how to add new modules or apps: see `GIT_WORKFLOW.md`.

---

## Regenerating decompiled trees

Tools used (installed locally, not in this repo):

- **apktool** — `C:\Users\redbull\Tools\apktool\apktool.jar`
- **jadx** — CLI on PATH; the GUI installer can be re-downloaded if needed
- Java (for apktool/jadx), Python 3.13 (for Frida CLI), Node.js (for the webapps)

### Eyecon

```bat
cd D:\ReverseAPI

:: the original filename contains '&', which breaks the apktool wrapper on exit;
:: make a short temporary tool copy, then remove it after decompiling
copy /Y "Eyecon Caller ID & Spam Block v4.2026.08.27.2228 [FileCR].apk" eyecon_tool.apk

:: resource + smali ground truth (needed for Frida hook method names)
java -jar C:\Users\redbull\Tools\apktool\apktool.jar d -f eyecon_tool.apk -o eyecon_apktool

:: deobfuscated Java sources
jadx -d eyecon_jadx eyecon_tool.apk

:: second pass with bad-code shown (helps some obfuscated methods)
jadx --deobf --show-bad-code -d eyecon_jadx_badcode eyecon_tool.apk

del eyecon_tool.apk
```

### TrueCaller

```bat
cd D:\ReverseAPI
java -jar C:\Users\redbull\Tools\apktool\apktool.jar d -f "Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk" -o truecaller_apktool
jadx --deobf -d truecaller_jadx "Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk"
```

> The original filename contains `&`; the commands above create a temporary short
> `eyecon_tool.apk` copy for tools and delete it when finished.

---

## Key research facts (Eyecon)

- Endpoint: `GET https://api.eyecon-app.com/app/getnames.jsp`
- Auth headers: `e-auth-v: e1`, `e-auth: <CID>`, `e-auth-k: PgdtSBeR0MumR7fO`,
  `e-auth-c: <checksum>`
- Checksum = sum of `Character.getNumericValue(first char)` of each hyphen-separated
  CID segment.
- CID is server-issued during registration; stored in the SQLite table
  `shared_preference_v2` of `databases/contactdb` (key `clientId`), **not** in XML prefs.
- Valid CID and verified live lookups are in `HANDOFF.md` (final status section) and `cid.txt`.

See `EYECON_ENDPOINTS.md` for the full endpoint map.

---

## Webapps

### Reference (Vite + React) — `eyecon_lookup_react/`

```bat
cd eyecon_lookup_react
npm install
npm run dev -- --host 127.0.0.1
```

Vite middleware in `vite.config.js` exposes `/api/lookup` so the browser avoids
Eyecon's CORS/custom-header restrictions. The CID is pre-filled in `src/App.jsx`.

### Production (client-only Next.js on Cloudflare Pages) — `app/`

Deployed at **https://callerid-lookup.pages.dev** from the `app/` root directory.
Cloudflare Pages serves a static export (`STATIC_EXPORT=1`); there are **no Next.js API
routes** or server-held secrets. Browser lookups go through the public Cloudflare Worker
relay in `app/relay-worker.js` (**https://callerid-relay.everse.workers.dev**), whose URL
is the default proxy template. Credentials are pasted in the UI and stored in that
browser's `localStorage`; no real CID or installationId is bundled. Both Eyecon and
TrueCaller providers are implemented and live-verified; users paste their own CID /
installationId in the UI. See `app/README.md`,
`truecaller_research/TRUE_CALLER_ENDPOINTS.md`, and `GIT_WORKFLOW.md`.
