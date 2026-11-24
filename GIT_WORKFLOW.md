# GIT_WORKFLOW.md — conventions for this research repo

This repo is a **text-only research archive**: notes, scripts, hooks, and webapp
source are versioned; APKs, decompiled trees, captured data, and tool downloads are
not. See `.gitignore` for the authoritative ignore list and `README.md` for setup
and regeneration commands.

## Branches and commits

- `main` is the only long-lived branch. Research here is a linear history, not a
  product release flow; avoid speculative topic branches.
- **Subagents do not run `git add` or `git commit`.** Parallel tasks finish their
  file edits and report back; the main agent commits them serially. This avoids
  `index.lock` contention between concurrent agents.
- Commit subjects are short and imperative, with an optional body for findings:

  ```text
  Add client-only Next.js lookup app
  Document TrueCaller endpoint findings
  Ignore Cloudflare and local env artifacts
  ```

- One logical change per commit. Do not amend, rebase, or reset commits made by
  someone else.
- Commit the lockfile (`package-lock.json`) with app source changes; do not commit
  installed dependencies or build output.
- Text uses `LF`, Windows scripts use `CRLF`, per `.gitattributes`. Local
  `core.autocrlf=false` keeps the attributes authoritative. `pull.rebase=true`
  keeps the linear history when syncing, and local identity is the neutral
  `Research <research@local>` (never set global config for this repo).

## Tracked vs. ignored

| Tracked (text only) | Ignored (stay on disk / local only) |
| --- | --- |
| `*.md` notes, `cid.txt` | `*.apk`, `*.apk.idsig`, `*.keystore`, `*.jks` |
| `*.ps1`, `*.bat`, `*.py` helpers | `*_apktool/`, `*_jadx/`, `*_jadx_badcode/` |
| `eyecon_hook*.js` Frida hooks | Frida binaries, `*.msi`, `*.xz`, `*.zip`, tool folders |
| `eyecon_lookup_react/`, `eyecon_lookup_webapp/` | `*.log`, `logcat_*.txt`, `*_out.txt`, runtime `*.db` / `*.sqlite*` |
| `app/` (Next.js source + lockfile) | `node_modules/`, `dist/`, `.next/`, `out/`, `.vercel/`, `.wrangler/`, `*.tsbuildinfo` |
| `truecaller_research/` notes | `.env`, `.env.*` (except `*.env.example` templates) |

The reason is reproducibility and size: derived trees, APKs, and captures can be
recreated from the source APK plus the commands in `README.md`, while committing
them would bloat the archive and leak runtime data. If a new artifact class appears,
add a narrow pattern to `.gitignore` — never a broad rule that hides source files.

## Regenerating decompiled trees

Decompiled trees are **derived**, never committed. After a fresh clone, follow
"Regenerating decompiled trees" in `README.md` to recreate `eyecon_apktool/`,
`eyecon_jadx*/`, `truecaller_apktool/`, and `truecaller_jadx/`. Use apktool smali
names for Frida hooks; jadx deobfuscated names are for reading only.

## Adding a new research module (`foo_research/`)

1. Create a top-level `foo_research/` folder containing plain-text notes:
   `PLAN.md`, `ENDPOINTS.md`, findings, and (if needed) small grep result files.
2. Name decompiled trees `foo_apktool/`, `foo_jadx/`, `foo_jadx_badcode/`. The
   existing `/*_apktool/`, `/*_jadx/`, and `/*_jadx_badcode/` rules already ignore
   them; verify with `git check-ignore -v foo_jadx/`.
3. Keep raw captures (`*.db`, `*.sqlite*`, `*.log`, `logcat_*.txt`) local. Record
   extraction/decompile commands in `README.md` so others can regenerate them.
4. Redact real tokens, phone numbers, and device IDs in notes unless the user has
   explicitly asked to keep them for research history (as with `cid.txt`).
5. Summarize endpoint/auth/checksum findings in `HANDOFF.md` / the relevant
   `*_ENDPOINTS.md` file, and update `README.md` layout if the module is permanent.

## Adding a new app

1. Use one top-level directory per app (e.g. `app/`), with its own `README.md`
   stating the deploy target/root directory and whether it is client-only.
2. Keep its source, `package.json`, and lockfile tracked. Build/dependency output
   (`node_modules/`, `.next/`, `dist/`, `out/`, `.vercel/`, `.wrangler/`, `*.tsbuildinfo`) and
   `.env*` files are ignored globally; add a narrow rule only for something new.
3. Never hardcode real credentials in components or scripts, and never commit
   `.env` files. Commit `*.env.example` templates with placeholder values only.
4. If the app is client-only (like `app/`), say so explicitly: lookups are direct
   browser `fetch()` calls, credentials are entered in the UI and stored in that
   browser's `localStorage`, and a CORS proxy may be user-configured. Do not claim
   server-side API routes that do not exist.

## Large binaries

APKs, keystores, Frida binaries, installers, decompiled trees, logs, and captured
databases stay on disk and are never committed — even temporarily. If one appears
in `git status`, fix `.gitignore` instead of force-adding it.

## Useful checks

```sh
git status --short                 # uncommitted changes
git status --ignored --short       # full audit; can be slow with large trees
git check-ignore -v <path>         # explain why a path is ignored
git ls-files | wc -l               # tracked file count
git ls-files -z | xargs -0 stat -c '%s %n' | sort -rn | head -20   # largest tracked files
```
