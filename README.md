# ReverseAPI

Reverse-engineering research for caller-ID / spam-lookup Android apps, and a web
frontend that reproduces their name + spam lookups.

**Repo root:** `D:\ReverseAPI`
**Live research target:** Eyecon (complete, working). Next target: TrueCaller.

---

## Layout

| Path | Tracked? | Purpose |
| --- | --- | --- |
| `HANDOFF.md` | yes | Research handoff / full history and final status |
| `EYECON_ENDPOINTS.md` | yes | Eyecon endpoint, auth, checksum, and response-field report |
| `AGENTS.md` | yes | Instructions for AI agents working in this repo |
| `cid.txt` | yes | The real server-issued Eyecon CID (checksum `38`) |
| `*.ps1`, `*.bat` | yes | Emulator / capture helper scripts |
| `eyecon_hook*.js` | yes | Frida hook scripts used for dynamic analysis |
| `eyecon_lookup_react/` | yes | Working Vite+React webapp (reference; CID pre-filled) |
| `eyecon_lookup_webapp/` | yes | Original plain Python/HTML prototype (reference) |
| `app/` | yes | **Next.js app for Vercel** (added in a later step) |
| `truecaller_research/` | yes | TrueCaller notes/plan (added in a later step) |
| `eyecon.apk`, `Truecaller*.apk` | no | Source APKs (keep on disk, gitignored) |
| `eyecon_apktool/`, `eyecon_jadx*/` | no | Decompiled trees (regenerate; see below) |
| `frida-*`, `*.msi`, `*.xz`, `*.zip` | no | Downloaded tools/binaries (gitignored) |
| `contactdb*.db`, `logcat_*.txt` | no | Captured runtime data (gitignored) |

> Large binaries, APKs, decompiled trees, and runtime dumps are **not** committed.
> They remain on disk. Use the commands below to regenerate them after a fresh clone.

---

## Regenerating decompiled trees

Tools used (installed locally, not in this repo):

- **apktool** — `C:\Users\redbull\Tools\apktool\apktool.jar`
- **jadx** — GUI `jadx-gui-1.5.7.msi` / CLI on PATH, or `D:\ReverseAPI\jadx-gui-1.5.7.msi`
- Java (for apktool/jadx), Python 3.13 (for Frida CLI), Node.js (for the webapps)

### Eyecon

```bat
cd D:\ReverseAPI

:: resource + smali ground truth (needed for Frida hook method names)
java -jar C:\Users\redbull\Tools\apktool\apktool.jar d -f eyecon.apk -o eyecon_apktool

:: deobfuscated Java sources
jadx -d eyecon_jadx eyecon.apk

:: second pass with bad-code shown (helps some obfuscated methods)
jadx --deobf --show-bad-code -d eyecon_jadx_badcode eyecon.apk
```

### TrueCaller

```bat
cd D:\ReverseAPI
java -jar C:\Users\redbull\Tools\apktool\apktool.jar d -f "Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk" -o truecaller_apktool
jadx --deobf -d truecaller_jadx "Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk"
```

> Use the short `eyecon.apk` copy for tools — the original filename contains `&`,
> which breaks the apktool wrapper on exit.

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

### Production (Next.js for Vercel) — `app/`

Added in a later step. Vercel setup: **Root Directory = `app`**.
The app will proxy Eyecon (and later TrueCaller) through Next.js API routes.
