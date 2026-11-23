# AGENTS.md — instructions for AI agents in this repo

## Scope

- Work **only** inside `D:\ReverseAPI`.
- This is a reverse-engineering research archive plus a webapp. Treat existing files
  as user work; investigate before deleting or overwriting.

## What is tracked vs. on-disk only

- **Tracked:** markdown notes (`HANDOFF.md`, `EYECON_ENDPOINTS.md`, `README.md`,
  `AGENTS.md`, `cid.txt`), helper scripts (`*.ps1`, `*.bat`), Frida hooks
  (`eyecon_hook*.js`), the Vite React reference app, and the upcoming Next.js `app/`.
- **Not tracked (see `.gitignore`):** APKs, `*_apktool/`, `*_jadx/`, `*_jadx_badcode/`,
  Frida binaries, `*.msi`/`*.xz`, logs, captured DBs. These stay on disk. Do not
  attempt to commit them. Regeneration commands are in `README.md`.

## Research workflow (what has worked)

1. **Static analysis** — apktool decode for smali ground truth (real method names),
   jadx `--deobf` for readable Java. Fake jadx names break Frida hooks; always use
   the smali names for hooking.
2. **Dynamic analysis** — Frida Gadget embedded in a **debuggable** rebuild of the APK
   works on the locked Xiaomi phone; `frida-server` does not (SELinux blocks the
   policy read). Hooking `NetworkHelper.j` with the full hook crashed the app on
   Android 16; a minimal HTTP-only hook was stable, but reading prefs via `run-as`
   was the reliable way to get the CID.
3. **CID extraction** — `EyeconSharedPreference` stores prefs in SQLite table
   `shared_preference_v2` inside `databases/contactdb`. Pull with `run-as`, query with
   `sqlite3`. Do **not** grep raw bytes for the CID (adjacent type-marker bytes create
   false endings).
4. **Live requests** — use the CID from `cid.txt`; `e-auth-c` checksum algorithm is in
   `eyecon_lookup_react/api/eyecon.js`. Both Caller ID and Search modes return 200.

## Devices

- Xiaomi phone: `adb -s jnroyp6tjzztqwfm` (real BD SIM, Android 16, locked/unrooted).
- Emulator: `emulator-5554` (AVD `Eyecon_GAPI_35`, rooted, but abandoned for real
  registration — SMS verification needs a real SIM).
- Use `-s` explicitly; both devices may be attached.

## Code style / conventions

- Keep webapp changes minimal and consistent with surrounding files.
- The Next.js app in `app/` must keep API keys/auth handling server-side (API routes),
  never in client components.
- Add any new endpoint/auth/checksum findings to `EYECON_ENDPOINTS.md` and update
  `HANDOFF.md` final status.
- Document regeneration steps for any new decompiled tree in `README.md`.

## Current state

Eyecon research complete (real CID + live lookups working). TrueCaller research and
Next.js app are the next tasks; see `truecaller_research/` and `app/` once created.
