# TrueCaller research — plan

Target APK: `D:\ReverseAPI\Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk`
Package: `com.truecaller` (confirmed from `truecaller_apktool/apktool.yml:2` and
`truecaller_apktool/AndroidManifest.xml:2`); version `26.43.5` / `2643005`
(`truecaller_apktool/apktool.yml:10-11`).

## Goal

Reproduce TrueCaller's **name + spam lookup** endpoint the same way as Eyecon:
1. Static analysis (apktool + jadx) to find the lookup endpoint, auth scheme, and
   number normalization.
2. Dynamic analysis on the Xiaomi phone to obtain any real auth token/ID.
3. Wire results into the Next.js app (`app/`) as a **client-only** integration:
   the browser fetches directly and the user pastes their own secrets, which are
   stored in localStorage (no server-side API route / no secrets on the server).

Scope: **name/spam lookup only** (no messaging, no social, no photos).

## Deliverables

- `truecaller_research/TRUE_CALLER_ENDPOINTS.md` — static endpoint/auth/response map with
  exact `file:line` citations.
- `truecaller_research/DYNAMIC_PLAN.md` — debuggable rebuild / Frida Gadget verification
  plan for obtaining a real token and confirming the request.
- `truecaller_research/apktool_decompile.log`, `truecaller_research/jadx_decompile.log` —
  retained decompilation provenance.

## Status

- [x] TrueCaller already installed on the Xiaomi phone (`jnroyp6tjzztqwfm`) — no install needed.
- [x] Static decompilation (apktool + jadx). apktool `APKTOOL_EXIT=0` with 10 smali sets;
  jadx produced 76,914 Java files but exited `3` with 1,241 decompile errors. apktool smali
  is ground truth. (`truecaller_research/apktool_decompile.log:1-22`,
  `truecaller_research/jadx_decompile.log:3-4`)
- [x] Identify lookup endpoint + params + auth headers — static candidate documented in
  `truecaller_research/TRUE_CALLER_ENDPOINTS.md`; live verification still pending.
- [x] Identify token/certificate scheme — Bearer token sources and restricted user-CA trust
  identified statically; active runtime branch still needs dynamic confirmation.
- [x] Decide dynamic-analysis route — debuggable rebuild / Frida Gadget, not root or
  frida-server; see `truecaller_research/DYNAMIC_PLAN.md`.
- [x] Live verification with real token (2026-11-23): debuggable rebuild installed, signed in,
      real `/v2/search` returned HTTP 200 with `"name":"Tasif"`. See `AUTH_AND_TESTING_FINDINGS.md` §6.
- [ ] Token lifetime / refresh behaviour — open question for next time, see
      `AUTH_AND_TESTING_FINDINGS.md` §8 (local TTL 72 h; server behaviour unconfirmed).
- [x] Next.js client-only integration (browser fetches directly; user pastes their own
      secrets into localStorage; no server API route and no server-held secrets). Implemented in
      `app/src/lib/providers/truecaller.js` using the static candidate; still needs live verification.

## Notes / commands

See `README.md` for regeneration commands. Decompiled trees are gitignored.

### Quick commands once trees exist

```bat
:: Find likely endpoints
grep -rn "https://" truecaller_jadx/sources/com/truecaller/ | grep -iE "search|lookup|name|spam"

:: Find auth/token handling
grep -rniE "authorization|bearer|x-api|token|signature" truecaller_jadx/sources/com/truecaller/ | head
```

### Scratch outputs

`_*` scripts/files and the `jadxscan/`, `netscan/` directories are retained scan/provenance
artifacts. Large duplicate grep dumps (`_grep_auth.txt`, `_grep_truecaller_urls.txt`,
`_contactdto_refs.txt`, `_smali_https.txt`) were removed before commit; the useful findings
are cited in `TRUE_CALLER_ENDPOINTS.md`.

## Key open questions

- Does TrueCaller require a real registered account for lookup, or is there a
  public/search endpoint usable without login (as in older versions)?
- Which active auth branch supplies the Bearer token: cross-domain
  `auth_token_cross_domain`, exchanged installation ID, or `featureClientAuthV2`?
- Which `type` value should the browser use for plain name+spam lookup?
- Does the `[FileCR]` mod affect auth/signature compared with an official build?
