# Eyecon reverse-engineering — handoff / next-day resume

**Status (2026-11-23): COMPLETE — live lookups working.** Real CID obtained from the Xiaomi phone after registration; Vite React webapp returns name/spam lookups end-to-end. See the final status section at the bottom of this file.

---

## 1. Goal / agreed scope

- Work only inside `D:\ReverseAPI`.
- Target APK: `D:\ReverseAPI\Eyecon Caller ID & Spam Block v4.2026.08.27.2228 [FileCR].apk`.
- Copy used for tools: `D:\ReverseAPI\eyecon.apk` (original filename has `&`, which breaks apktool wrapper).
- Webapp scope is **only** `GET /app/getnames.jsp`:
  - **Name + spam** (`is_callerid=true`)
  - **Name history** (all `name` values from the same response / search variant)
- Social-media/photo endpoints are **out of scope** for now.
- User’s main use case: **Bangladeshi numbers, starting with `+880`**.
- Test number user supplied: **`01632-027018`** → normalized to **`cli=8801632027018`** (trunk `0` stripped).

---

## 2. What is already done

### APK analysis
- `D:\ReverseAPI\eyecon_apktool` — apktool decode (resources + smali, ground truth).
- `D:\ReverseAPI\eyecon_jadx` — jadx `--deobf` decompile (57,115 Java files).
- `D:\ReverseAPI\eyecon_jadx_badcode` — second jadx pass with `--show-bad-code` (514 errors; no material recovery).
- `D:\ReverseAPI\EYECON_ENDPOINTS.md` — consolidated endpoint/crypto/remote-config report.

Key findings (confirmed in decompiled sources):
- Request:
  ```text
  GET https://api.eyecon-app.com/app/getnames.jsp
      ?cli=<digits with country code, no "+">
      &lang=en
      &is_callerid=true|false
      &is_ic=false
      &apsversion=vc_785_vn_4.2026.08.27.2228_a
      &requestApi=okHttp|URLconnection
      &source=<call site>
      [&is_search=true]
  ```
- Number normalization: `PhoneNumberHelper.m16597e()` → libphonenumber E164 → `C8676OH.m16256N()` strips `+`.
- Response fields read in `RunnableC8493c.java:259-377`: `name`, `type` (`spam` / `maybe spam`), `suspicious_spam`.
- `namesListener.mo15098a((String[]) arrayList4.toArray(new String[0]), spam, 0)` receives all names → name history.
- Response format quirk (found while building the client-only app): without `Accept: application/json`
  the server may return a bare name string (e.g. `TAS IF?`) instead of a JSON array. Send
  `Accept: application/json` and make the parser tolerate both shapes.
- CORS: the `e-auth-*` headers trigger a browser preflight, and `OPTIONS /app/getnames.jsp`
  returns **401 with no CORS headers**, so direct browser `fetch` is blocked even though
  `curl` works. The Next.js app exposes an optional, user-configured CORS-proxy template
  (`{url}` / `{rawUrl}` / `{headers}` tokens) stored in localStorage; blank = direct fetch.
- Auth headers (`NetworkHelper.java:330-339`):
  ```text
  e-auth-v: e1
  e-auth: <clientId / CID>
  e-auth-c: <checksum>
  e-auth-k: PgdtSBeR0MumR7fO
  ```
- Checksum = sum of `Character.getNumericValue()` of the **first char of each hyphen-separated segment** of the CID.
- CID is **server-issued**, not locally derivable:
  - `RunnableC8496f.java:164-186` calls `social_auth/use_cli_validation` with `device_id` (Android ID), `cli`, `advid`.
  - Server response string is saved as `clientId` preference (`PhoneNumberValidationActivity.java:615-621`) and sent as `e-auth`.
  - No hardcoded CID found in APK resources/smali.
  - Made-up UUID + correct checksum still returns **401**.
- App is not debuggable, `allowBackup=false`, network config trusts **system CAs only**. Plain user-CA mitm will not work; `run-as`/`adb backup` will not work.

### Webapp (done, needs restart)
Primary app: **`D:\ReverseAPI\eyecon_lookup_react`** (Vite + React, dependency-light after `npm install`).

Files:
```text
D:\ReverseAPI\eyecon_lookup_react\
  package.json
  vite.config.js          # Vite plugin exposes /api/lookup in dev AND preview
  api\eyecon.js           # request builder, auth checksum, response parser
  index.html
  src\main.jsx
  src\App.jsx             # UI, +880 default country dropdown, trunk-0 stripping
  src\styles.css
  README.md
  dist\                   # successful production build
```

Status:
- `npm install` succeeded (65 packages).
- `npm run build` succeeded.
- Dev server was started but later killed by tool timeout; **restart it next day**:
  ```powershell
  cd D:\ReverseAPI\eyecon_lookup_react
  npm run dev
  ```
  URL: `http://127.0.0.1:5173`.
- No Python server needed. Vite middleware handles `/api/lookup`, so browser avoids Eyecon CORS/custom headers.
- Country dropdown defaults to **Bangladesh (+880)**. Also India, Pakistan, Nepal, Sri Lanka, USA, UK, Australia, UAE, Saudi, Custom.
- Normalization verified: `01632-027018` → `8801632027018`.
- API test with fake CID returned clean `401` + error message; no crash.

Old Python version still exists at `D:\ReverseAPI\eyecon_lookup_webapp` but is **stopped and superseded**.

---

## 3. Android tooling installed today

- **Android Studio** `2026.2.2.10` installed via winget (machine scope, UAC was approved).
  - `C:\Program Files\Android\Android Studio\bin\studio64.exe`
- **SDK root:** `C:\Users\redbull\AppData\Local\Android\Sdk`
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` already point here.
  - `JAVA_HOME` = `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`; JDK 21 also available at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`.
- **Command-line tools** downloaded and extracted:
  - Zip: `C:\Users\redbull\AppData\Local\Temp\opencode\commandlinetools.zip` (`commandlinetools-win-13114758_latest.zip`)
  - Installed to: `C:\Users\redbull\AppData\Local\Android\Sdk\cmdline-tools\latest`
  - Contains `sdkmanager.bat`, `avdmanager.bat`.
- **SDK packages installed via sdkmanager** (licenses accepted):
  - `platform-tools` (37.0.3)
  - `emulator`
  - `platforms;android-35`
  - `build-tools;35.0.0`
  - `system-images;android-35;google_apis;x86_64`
- **AVD created:**
  ```text
  Name:   Eyecon_GAPI_35
  Device: pixel_7
  Target: Google APIs (Google Inc.)
  Based on: Android 15.0 ("VanillaIceCream"), google_apis/x86_64
  Path:   C:\Users\redbull\.android\avd\Eyecon_GAPI_35.avd
  ```
- **adb binaries:**
  - SDK: `C:\Users\redbull\AppData\Local\Android\Sdk\platform-tools\adb.exe`
  - winget Platform Tools: `C:\Users\redbull\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe`
- **VC++ 2015–2022 x64 redistributable** installed/upgraded (`Microsoft.VCRedist.2015+.x64`, 14.52.37029.0).
- **.NET Framework 4.8.1** installed as a dependency of the diagnostics tool.
- **Dependencies** DLL analyzer installed:
  ```text
  C:\Users\redbull\AppData\Local\Microsoft\WinGet\Packages\lucasg.Dependencies_Microsoft.Winget.Source_8wekyb3d8bbwe\Dependencies.exe
  ```

---

## 4. Current blocker (important)

The emulator **exits immediately** with code `1` / `-1073741515` = **`0xC0000135 STATUS_DLL_NOT_FOUND`**.

Evidence:
- `emulator.exe -avd Eyecon_GAPI_35 ...` → exit 1, no stdout.
- `emulator.exe -verbose ...` → still no output.
- `emulator.exe -accel-check` → exit `-1073741515`.
- `emulator.exe -list-avds` → exit `-1073741515`.

So the failure happens **before** AVD/acceleration logic — it is a missing DLL at process startup, not a Hyper-V/HAXM problem.

Already ruled out:
- VC++ redist present (upgraded today).
- Emulator folder contains `msvcp140*.dll`, `vcruntime140*.dll`, `concrt140.dll`, etc.
- `libwinpthread-1.dll` exists in `build-tools\35.0.0`.
- Missing candidates found in SDK: `libstdc++-6.dll`, `libgcc_s_seh-1.dll`, `libglib-2.0-0.dll`, `zlib1.dll` — but not yet confirmed as the actual cause.

### DLL dependency scan — completed after handoff was first written
Background shell `sh_20347889b001xHis1XtH4I04q3` finished.

- Raw output: `C:\Users\redbull\AppData\Local\Temp\opencode\emu_modules.txt` (1,062 lines).
- Command used:
  ```powershell
  "C:\Users\redbull\AppData\Local\Microsoft\WinGet\Packages\lucasg.Dependencies_Microsoft.Winget.Source_8wekyb3d8bbwe\Dependencies.exe" -modules "C:\Users\redbull\AppData\Local\Android\Sdk\emulator\emulator.exe"
  ```
- Result: **all statically imported DLLs resolved**. No `NOT FOUND` / missing-module lines.
  The `error` matches from the earlier grep were only Windows API-set names such as
  `api-ms-win-core-errorhandling-*`, `api-ms-win-core-windowserrorreporting-*`,
  `api-ms-win-core-winrt-error-*` — not failures.
- Therefore the `0xC0000135` is **not a missing static import**. Likely causes to check next:
  - a **delay-loaded / dynamically `LoadLibrary`'d** DLL (Qt platform plugin),
  - missing `lib64\qt\plugins\platforms\qwindows.dll`,
  - missing `libGLESv2.dll` / `libEGL.dll` / Vulkan/ANGLE DLLs under `emulator\lib64`,
  - a bad/incomplete emulator package extract.

No further action was taken after this result — stop for the day as requested.

Other finished background shells:
- `sh_203401eea001zsH2f1wWrS0tQT` — emulator boot attempt, exited 1.
- `sh_203403b8c001sUY1XhJuu0lLG0` — `adb wait-for-device` boot-wait, was stopped manually; it had started the adb daemon on port 5037.

---

## 5. Next steps (ordered)

### Step A — Identify and fix the runtime DLL load failure
The static import scan is already done and found **no missing imports**. Start here instead:

1. Inspect dynamically loaded / delay-loaded dependencies:
   ```powershell
   $dep = "C:\Users\redbull\AppData\Local\Microsoft\WinGet\Packages\lucasg.Dependencies_Microsoft.Winget.Source_8wekyb3d8bbwe\Dependencies.exe"
   $emu = "C:\Users\redbull\AppData\Local\Android\Sdk\emulator\emulator.exe"
   & $dep -imports $emu
   & $dep -chain $emu
   ```
2. Check these specific runtime files exist:
   ```text
   C:\Users\redbull\AppData\Local\Android\Sdk\emulator\lib64\qt\plugins\platforms\qwindows.dll
   C:\Users\redbull\AppData\Local\Android\Sdk\emulator\lib64\libGLESv2.dll
   C:\Users\redbull\AppData\Local\Android\Sdk\emulator\lib64\libEGL.dll
   ```
   If the Qt platform plugin is missing, that alone can produce `0xC0000135`.
3. Simplest high-confidence fix — refresh the emulator package:
   ```powershell
   Remove-Item -Recurse -Force "C:\Users\redbull\AppData\Local\Android\Sdk\emulator"
   & "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --install emulator --channel=0
   ```
   Then re-test:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -accel-check
   ```
4. If still broken, use ProcMon or Windows Event Log to see the exact DLL being requested at process start, or install an older emulator version via sdkmanager.

### Step B — Boot the AVD
```powershell
C:\Users\redbull\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Eyecon_GAPI_35 -no-snapshot-load -no-boot-anim -gpu swiftshader_indirect -memory 4096
```
Then, in another shell:
```powershell
$adb = "C:\Users\redbull\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb wait-for-device
& $adb shell getprop sys.boot_completed    # wait until it prints 1
& $adb devices
```

### Step C — Confirm root and install APK
```powershell
$adb = "C:\Users\redbull\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb root
& $adb shell id                 # expect uid=0(root)
& $adb install -r D:\ReverseAPI\eyecon.apk
```
If install verification blocks:
```powershell
& $adb shell settings put global package_verifier_enable 0
& $adb shell settings put global verify_apps_over_usb 0
& $adb install -r D:\ReverseAPI\eyecon.apk
```
If `adb root` fails, the AVD is wrong — recreate with a **Google APIs** image (not Google Play).

### Step D — Register in the app (needs the user)
- Open Eyecon in the emulator.
- Register with the target Bangladeshi number.
- OTP arrives on the user’s **physical phone**; choose **manual entry** (emulator has no SIM/SMS retrieval).
- Completing registration stores `clientId` in app prefs.

### Step E — Extract the CID
```powershell
& $adb shell cat /data/data/com.eyecon.global/shared_prefs/com.eyecon.global_preferences.xml | findstr clientId
```
Alternative: Frida hook `com.eyecon.global.Registration.Authenticator.d()` (real DEX name is `d()`, not jadx’s `m16803d()`).

### Step F — Run the lookup
```powershell
cd D:\ReverseAPI\eyecon_lookup_react
npm run dev
```
Open `http://127.0.0.1:5173`, paste the CID, keep **Bangladesh (+880)**, enter `01632-027018`, click **Look up**. Then switch mode to **Search** to view all name values (name history).

---

## 6. Fallback if emulator stays broken

- **Physical phone, no USB adb:** enable **Wireless debugging** (Android 11+), pair over Wi‑Fi, then use the same adb/Frida steps.
- **Rooted phone:** Termux → `su` → `cat /data/data/com.eyecon.global/shared_prefs/com.eyecon.global_preferences.xml | grep clientId`.
- **mitmproxy:** possible only after installing the mitm CA as a **system** CA (Magisk `AlwaysTrustUserCerts` / MoveCertificate), because the app trusts only system CAs.
- Another emulator product (e.g. Genymotion) with a Google-APIs-style rootable image.

---

## 7. Remember

- Do **not** delete any folders under `D:\ReverseAPI`; they are all analysis artifacts.
- The Python webapp is obsolete but harmless.
- API returns `401` until a real CID is supplied; that is expected and already handled gracefully in the React UI.
- The exact test normalization to re-verify: `01632-027018` → `cli=8801632027018`.

---

## 8. Live update — 2026-11-23

### Emulator startup fix (done)
Root cause of `0xC0000135 STATUS_DLL_NOT_FOUND` was **not** the Qt/GLES libraries: it was a missing Windows Media Foundation import, `MFPlat.DLL`.

Evidence:
- `Dependencies.exe -modules emulator.exe` showed `[NOT_FOUND] MFPlat.DLL`.
- `MFPlat.DLL` does not exist in `C:\Windows\System32` on this machine (Media Foundation feature is not fully installed).
- Compatible copies exist in `C:\Windows\WinSxS\amd64_microsoft-windows-mfplat_*` (version 10.0.26100.1).

Fix applied without elevation or system changes:
```powershell
# Script: D:\ReverseAPI\copy_mf.ps1
# Copied from WinSxS into C:\Users\redbull\AppData\Local\Android\Sdk\emulator\
mfplat.dll
mftranscode.dll
mfcore.dll
mfreadwrite.dll
MFMediaEngine.dll
mfh264enc.dll
```
After this, `emulator.exe -accel-check` returns:
```text
WHPX(10.0.26200) is installed and usable.
```

### AVD and APK state (done)
- The documented AVD name did not exist; only `Pixel6_API34` was present.
- Recreated with:
  ```powershell
  avdmanager create avd -n Eyecon_GAPI_35 -k "system-images;android-35;google_apis;x86_64" -d pixel_7 --force
  ```
- Emulator is launched detached using `D:\ReverseAPI\start_emulator.ps1` so the tool shell timeout does not kill it.
- Booted successfully with WHPX + SwiftShader; `sys.boot_completed=1`, device `emulator-5554`.
- APK install needed the `-d` flag:
  ```powershell
  adb install -r -d D:\ReverseAPI\eyecon.apk
  ```
  Result: `Success`.
- Launching the app lands on `com.eyecon.global/.Registration.RegistrationActivity`.

### Webapp state
- Vite dev server is running at `http://127.0.0.1:5173` (confirmed HTTP 200).
- Note: background shells started with the generic shell tool can be killed at their timeout. For long-lived processes use `Start-Process` / detached processes.

### Current blocker
- Need a real server-issued CID.
- Direct unauthenticated probes still fail:
  - `social_auth/use_cli_validation` → 401
  - `cli_auth/checkcode` with dummy code → 400
  - made-up UUID + correct `e-auth-c` → 401 on `getnames.jsp`
- A background general-purpose agent (session `ses_df878be87ffetcQE8wub1405ks`) is tracing the full CID lifecycle backwards from `EyeconEditor.m16214c(..., "clientId")`.

### Immediate next actions after agent report
1. Try any anonymous/join endpoint the agent identifies with a clean `curl` request.
2. If no direct endpoint works, complete registration in the emulator and read:
   ```powershell
   adb root
   adb shell cat /data/data/com.eyecon.global/shared_prefs/com.eyecon.global_preferences.xml | findstr clientId
   ```
   (If `adb root` is unavailable, try `adb shell su -c '...'` on the google_apis image.)
3. Paste CID into the webapp and run Caller ID + Search modes for `01632-027018`.

---

## FINAL STATUS (2026-11-23) — COMPLETE ✅

### Real CID obtained and live lookups working
- **Phone:** Xiaomi `jnroyp6tjzztqwfm` (Android 16, locked/unrooted), real BD SIM.
- Registration completed in Eyecon with `+880 1338280635`, first name `Eyeof`, last name `Sauron`.
- The Frida Gadget build crashed the app on network calls; solution was a **debuggable-only** rebuild
  (no Gadget) so `run-as` works:
  - `eyecon_apktool` smali: removed `System.loadLibrary("frida-gadget")` from `MyApplication`.
  - Removed `lib/arm64-v8a/libfrida-gadget*.so`.
  - `AndroidManifest.xml` keeps `android:debuggable="true"`.
  - Rebuilt: `eyecon_debuggable.apk` (signed with `debug.keystore`).
- CID extracted from app data (SQLite, **not** XML):
  - `EyeconSharedPreference` stores prefs in table `shared_preference_v2` of `databases/contactdb`.
  - Query: `sqlite3 contactdb_live.db "SELECT key,data FROM shared_preference_v2 WHERE key='clientId';"`
  - **CID = `976f3b43-253a-48fa-a49a-d76be98e3d88`**
  - Important gotcha: a raw binary grep showed `...3d8844` because `44` was the next field's
    type marker byte. Use sqlite3 to get the exact value.
  - Checksum (`e-auth-c`) = **38**.
- `authenticatedCli` = `8801309949002` (the number the server bound to auth), while registered
  number was `8801338280635` — flash SMS upgraded to a server-assigned CLI.

### Live verification
```text
GET /app/getnames.jsp?cli=8801632027018&... with e-auth=<CID>
  → HTTP 200  body: [{"name":"TAS IF?","type":""}]
```
Both Caller ID (`is_callerid=true`, `requestApi=okHttp`) and Search
(`is_search=true`, `requestApi=URLconnection`) modes return 200 with `TAS IF?`.

### Webapp final state
- CID pre-filled in `src/App.jsx` default state; also saved in `D:\ReverseAPI\cid.txt`.
- Vite dev server running at **http://127.0.0.1:5173** (npm run dev -- --host 127.0.0.1).
- `npm run build` succeeds.
- End-to-end `/api/lookup` test for `+8801632027018` → `ok:true`, `names:["TAS IF?"]`.

### Useful files created
- `D:\ReverseAPI\eyecon_debuggable.apk` — debuggable, no Gadget (installed on phone).
- `D:\ReverseAPI\cid.txt` — the real CID.
- `D:\ReverseAPI\contactdb_live.db` — pulled app DB (contains `shared_preference_v2`).
- `D:\ReverseAPI\logcat_phone.txt` — passive logcat capture during registration.
- `D:\ReverseAPI\debug.keystore` — signing key for the debuggable rebuild.

---

## NEXT HANDOFF (2026-11-23, end of day)

Both providers are now **live-verified**. The client-only Next.js app in `app/` is the
deliverable; the Vite app at `http://127.0.0.1:5173` is an older reference only.

### TrueCaller — complete
- Endpoint/auth/response fully verified live (not just static). See
  `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §6–7.
- Confirmed request: `GET https://search5.truecaller.com/v2/search?q=%2B<e164>&countryCode=<ISO2>&type=2&encoding=json`,
  with `Authorization: Bearer <installationId>` and `Accept: application/json`.
- The Bearer value is the account's **`installationId`**, read from
  `shared_prefs/account.xml` on a debuggable rebuild of the app. It has a **72-hour TTL**
  (`installationIdTtl=259200000`). **Never commit it** — each user pastes their own in the UI.
- The value fetched today was dated `2026-11-23T12:11:22Z`, so its local expiry estimate is
  **`2026-11-26T12:11:22Z`**. Server-side enforcement and the refresh procedure are **open
  questions** — recorded in `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §8; ask/investigate
  next time.
- Local dev convenience: both credentials are in gitignored `app/.env.local` as `NEXT_PUBLIC_*`
  defaults; copy `app/.env.example` to create it on another machine. The UI overrides them and
  saves to localStorage. **Next.js inlines `NEXT_PUBLIC_*` into the client bundle** — use only
  dev/throwaway values there; real credentials belong in the browser UI.
- Real response returned `"name":"Tasif"` for `+8801632027018` (matching Eyecon's `TAS IF?`).
- Response shape uses `isFraud` and `feedback.feedbackType` (not `spamInfo`); the provider
  parser was corrected accordingly.
- `truecaller_debuggable.apk` (113 MB, gitignored) is on disk if another token is ever needed.
- Install note: `adb install` is blocked by MIUI; use `MSYS_NO_PATHCONV=1 adb push ... /data/local/tmp/tc.apk`
  then `adb shell pm install -r /data/local/tmp/tc.apk`.

### Design intent — `caller_id_lookup_design.zip`
Extracted to `_design_review/` (gitignored). Four Stitch-generated Tailwind screens:

| Screen | File |
|---|---|
| Lookup (web) | `stitch_multi_provider_phone_lookup/caller_id_lookup_web/code.html` |
| Lookup (mobile) | `stitch_multi_provider_phone_lookup/caller_id_lookup_mobile/code.html` |
| Settings (web) | `stitch_multi_provider_phone_lookup/settings_web/code.html` |
| Settings (mobile) | `stitch_multi_provider_phone_lookup/settings_mobile/code.html` |

Key design decisions to carry into the Next.js app:
- **Header** with `call` icon + "Caller ID Lookup" + Settings button.
- **Multi-select provider segmented control** (Eyecon / TrueCaller / NumVerify) — choose one
  or more, and run all selected providers for a single lookup. Current app uses a single
  provider dropdown — this is the biggest gap.
- **Input mode tabs**: Single number vs Multiple / CSV (comma/newline, `.csv` upload,
  live number count). Not present in the current app.
- **Mode radios**: Caller ID / Search / name history (current app has this).
- **Results**: one card **per provider**, with names list, spam-status badge, HTTP status,
  `via proxy` label, and an expandable "Request URL & raw response" `<details>`.
- **Settings modal / page**: per-provider enable toggles + credential fields; a "Client ID
  required" alert banner on the lookup page links into settings. Eyecon CID input has a
  show/hide toggle. Plain text `localStorage` keys in the design (`caller_id_eyecon_client_id`)
  — keep the app's current `callerid-lookup:settings:v1` instead, it is fine.
- **Visual system**: Material Design 3 color tokens (light + dark), Tailwind CDN, Material
  Symbols icons, `max-w-4xl`, rounded cards, dense typography scale.
- Design contains a third provider, **NumVerify** (access key). Not implemented/researched —
  either drop it from the UI or treat it as a future placeholder.

### Current Next.js app status
- `npm run build` passes (Next.js 15.5.29).
- Dev server was started in the background for testing: **http://localhost:3000** → HTTP 200.
- Tests to run before handoff: select Eyecon (CID pre-filled) → `01632-027018` → Look up;
  then TrueCaller with a **fresh** installationId pasted into the "Bearer token" field.
- **CORS is now handled by default**: `next.config.mjs` has same-origin rewrite prefixes
  `/p/eyecon/`, `/p/tc/`, `/p/tc-eu/`, `/p/tc-noneu/`; `http.js` selects them automatically when
  the proxy field is blank. No API route, no server-held secrets — the browser sends its own
  CID/token. Eyecon verified HTTP 200 through the relay.
- **TrueCaller caveat**: its WAF fingerprints TLS. Windows `curl` (Schannel) gets 200, but
  Node/OpenSSL clients used by `next dev` rewrites get 401/429. The older Vite app worked only
  because it proxied Eyecon, which does not fingerprint. Options and details in
  `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §9. Next test: check if Vercel's edge rewrite
  passes the WAF after deployment.
- Public CORS proxies are not a fallback: corsproxy.io now requires a paid key and the other free
  ones tested were dead. `app/.env.local` holds dev defaults; copy `app/.env.example` to recreate.
- **TrueCaller relay — VERIFIED 2026-11-24:** `app/relay-worker.js` deployed as a free Cloudflare
  Worker. Its TLS stack passes TrueCaller's WAF: `Tasif` returned HTTP 200 with
  `Access-Control-Allow-Origin: *`. `app/.env.local` sets `NEXT_PUBLIC_CORS_PROXY_TEMPLATE` to the
  worker URL so both providers work out of the box; `app/.env.example` documents the variable.
  Wrangler 4.167.0 is installed globally and logged in as `redbullisland@gmail.com` (account
  `RedBull` / `30a1c3fa06575a01ad506abb4b3f2a59`). The first deploy used a temporary preview
  account. The **permanent worker** `https://callerid-relay.everse.workers.dev` is deployed and
  verified (TrueCaller `Tasif`, Eyecon `TAS IF?`, both HTTP 200) and is now the URL in `.env.local`.
  Deploy command:
  `wrangler deploy app/relay-worker.js --name callerid-relay --compatibility-date 2026-11-24`.
  NumVerify needs no proxy at all (`Access-Control-Allow-Origin: *`).

### Repo state
Commits after the original Eyecon work: `6e26996` (client app), `3107b46` + `acb63c6`
(TrueCaller research/docs), `615d704` (TrueCaller provider), `86098ff` (URL display),
`a9b9a25` + `068efa0` (auth findings + ignores), `94e95a3` (live verification + parser fix),
`3fdbfef` (design/handoff), `064c3f0` (relay + env defaults), `0a18ebd` (Cloudflare Worker relay).
Working tree is clean; bulky artifacts and captures are gitignored but retained on disk.

---

## END OF DAY 2026-11-23 — FINAL SUMMARY / NEXT SESSION

### Working state
- Next.js app in `app/`: `npm run build` passes; dev server running at **http://localhost:3000**.
- **Eyecon: fully working**, including in the browser via the built-in same-origin rewrite relay
  (verified HTTP 200, `TAS IF?` for `01632-027018`). Proxy field should be left blank.
- **TrueCaller: API contract fully verified** (HTTP 200 `Tasif` via terminal `curl`), parser fixed,
  but **not reachable from the web app** locally because its WAF fingerprints TLS: curl/Schannel
  passes, Node/OpenSSL (next dev) gets 401/429. Browser-direct is CORS-blocked (`OPTIONS` 403).
- Dev credentials in gitignored `app/.env.local` (CID + a 72 h installationId obtained today).
  Never commit real tokens; copy `app/.env.example` to recreate.

### User decisions / preferences carried forward
- Both providers are required. **NumVerify is wanted later** (third provider in the design zip).
- App must stay client-only (no API routes, no server-held secrets). User pastes their own secrets;
  stored in browser localStorage. Vercel Root Directory = `app`.
- Keep the design intent from `caller_id_lookup_design.zip` in mind (multi-select providers,
  batch/CSV input, per-provider result cards, settings modal) — none implemented yet.
- Research style: document findings in `.md`; user wants to be told what to do, not shown UI capture.

### Next session — ordered
1. **Test TrueCaller through a different TLS stack** (the only real blocker):
   - (a) Deploy current app to **Vercel** (Root Directory `app`) and retry TrueCaller with blank
     proxy field — the edge rewrite may pass the WAF. Cheapest first test, and deploy is needed anyway.
   - (b) If that fails, deploy **`app/relay-worker.js`** to a free Cloudflare Worker and paste
     `https://<worker>.workers.dev/?url={url}&{headers}` into the app's proxy template.
   - (c) If both fail: TLS-impersonating client (`tls-client` Chrome profile) in a Vercel function,
     or a headless-Chrome container. Less portable, but reliable.
2. **Token lifetime / refresh questions** — see `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §8.
   Local TTL is 72 h (today's token expires ~2026-11-26 12:11 UTC). Confirm server behaviour,
   whether the app auto-renews, what error expiry returns, and how to refresh without OTP.
3. **Add NumVerify provider** — easy: `GET https://apilayer.net/api/validate?access_key=...&
   number=...&country_code=...`, direct browser fetch works (`Access-Control-Allow-Origin: *`),
   no proxy needed. User supplies their own access key via localStorage.
4. Revisit the design gaps (multi-provider selection, batch input, settings UI) once TrueCaller
   reachability is settled.

### Key references
- `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §6 = live verification, §8 = open questions,
  §9 = TLS fingerprint diagnosis, §10 = Cloudflare Worker relay + NumVerify CORS.
- `HANDOFF.md` earlier sections = full Eyecon reverse-engineering history.
- `tc_signin_logcat.txt`, `tc_live_response.txt` = gitignored captures kept on disk.
