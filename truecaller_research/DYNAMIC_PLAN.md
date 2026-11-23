# TrueCaller v26.43.5 — dynamic verification plan

Goal: obtain one real token and one real `/v2/search` response so the static candidate in
`truecaller_research/TRUE_CALLER_ENDPOINTS.md` can be confirmed or corrected.

Do this only with an account/numbers you control. Treat captured Bearer tokens and
installation IDs as secrets; do not paste them into notes, commits, screenshots, or issues.

## 0. Constraints and assumptions

- The primary Xiaomi device is locked/no root. Do **not** plan around `frida-server` or a
  system CA.
- The stock APK trusts user CAs only under `debug-overrides`
  (`truecaller_apktool/res/xml/network_security_config.xml:3-7`), and the app references
  that config from the manifest (`truecaller_apktool/AndroidManifest.xml:207`). Therefore
  stock user-CA MITM should not work.
- Use a **debuggable rebuild** or **Frida Gadget packaged into the app**, not a stock install.
- Work from temporary copies. The existing `truecaller_apktool/`, `truecaller_jadx/`, and
  `truecaller_jadx_badcode/` trees are read-only sources for this research.
- apktool smali is ground truth because jadx exited with 1,241 errors
  (`truecaller_research/jadx_decompile.log:3-4`).

---

## 1. Preferred route: debuggable rebuild + user CA

### 1.1 Prepare a temporary build tree

1. Copy `truecaller_apktool/` to a temporary working directory.
2. In the copy only, set `android:debuggable="true"` on the `<application>` element
   (manifest line 207 in the source tree).
3. In the copy only, add a `<debug-overrides>` trust anchor for the proxy CA in
   `res/xml/network_security_config.xml`. Keep it debug-scoped; do not weaken production
   traffic globally.
4. Rebuild and sign with a debug key using `apktool b` + `apksigner`.
5. Install on the Xiaomi device.
   - Keeping the same package name is important: changing it can break account/credential
     lookup (`dd70.m51831e()` reads package-scoped preferences at
     `truecaller_jadx/sources/p000/dd70.java:373-390`).
   - Installing the same package over the stock app requires uninstalling/replacing it, so
     back up or use a secondary device/profile.

For Eyecon, a debuggable rebuild + `run-as` was sufficient; here the rebuild is mainly to
enable debug CA trust and make process inspection possible.

### 1.2 Proxy capture

1. Start mitmproxy/Charles/Burp with the generated CA installed as a **user** CA.
2. Launch the rebuilt TrueCaller.
3. Trigger a caller-ID lookup for a controlled phone number.
4. Filter for `search5`, then inspect:
   - full URL and query parameter order,
   - `Accept`, `Authorization`, and any unexpected headers,
   - raw response body and `tc-event-id` header.
5. Save the raw body as `body.bin` and decode with:

```bat
protoc --decode_raw < body.bin > body.txt
```

If the body is JSON despite the protobuf `Accept`, save as `body.json` instead.

---

## 2. Alternative route: Frida Gadget

Use this if rebuilding the manifest/config is inconvenient or if the app fails after the
debuggable patch.

1. Make a temporary copy of the APK.
2. Inject Frida Gadget into an ABI directory that the app actually loads (check
   `truecaller_apktool/lib/`), using the standard Gadget rename/config approach.
3. Configure Gadget to listen on `127.0.0.1:<port>`.
4. Resign and install as in section 1.
5. Attach with `frida -H 127.0.0.1:<port> -f com.truecaller` or spawn-attach from the host.
6. Confirm the process is `com.truecaller` and that Java hooks can see `p000` classes.

This avoids root/frida-server. It does not by itself defeat certificate pinning, but for
this app the static config points to debug-CA trust as the main TLS obstacle
(`truecaller_apktool/res/xml/network_security_config.xml:3-7`).

---

## 3. Hooks to install

Exact method signatures must be confirmed in smali before running a script; JADX may have
renamed parameters. The useful classes and evidence are:

| Hook target | Purpose | Static evidence |
|---|---|---|
| `p000.pg4.intercept` | log final URL and `Authorization` header | `truecaller_jadx/sources/p000/pg4.java:73-130`; `truecaller_apktool/smali_classes5/pg4.smali:98,333-357` |
| `p000.b920.m6466b` | log `q`, `countryCode`, `type`, `targetDomain` before the call | `truecaller_jadx/sources/p000/b920.java:176-211` |
| `p000.b920.m6469e` | log `if00`/`jf00(KnownDomain)` host decision | `truecaller_jadx/sources/p000/b920.java:233-255` |
| `p000.ylp.intercept` | log `KnownEndpoints` tag attached to the request | `truecaller_jadx/sources/p000/ylp.java:20-25` |
| `p000.y660.m96009a`, `m96010b` | determine whether cross-domain token is fetched/cached | `truecaller_jadx/sources/p000/y660.java:43-155` |
| `p000.dd70.m51831e`, `m51837k` | determine whether installation-ID exchange is used | `truecaller_jadx/sources/p000/dd70.java:373-390`, `:443-489` |
| `p000.og4.invokeSuspend` / `p000.d30` | determine whether `featureClientAuthV2` is active | `truecaller_jadx/sources/p000/pg4.java:98-99`; `truecaller_jadx/sources/p000/og4.java:54-58` |
| `p000.tst.mo74147H` | capture status, headers, and parsed `ContactDto` | `truecaller_jadx/sources/p000/tst.java:46-82` |
| `okhttp3.Request$Builder.addHeader` | generic backup capture of every auth header | used indirectly by `pg4.java:127-129` |

Log values, not secrets, wherever possible. For example, log token length and a short
prefix/suffix rather than the full Bearer token unless a local capture file is required.

---

## 4. Live request matrix

After capturing one working request, replay it with a trimmed secret:

```bat
curl -sS -D headers.txt ^
  -H "Accept: application/x-protobuf" ^
  -H "Authorization: Bearer <TOKEN>" ^
  "https://search5.truecaller.com/v2/search?q=%%2B15551234567&countryCode=US&type=2&encoding=json" ^
  -o body.bin
```

Test matrix:

| Variable | Values |
|---|---|
| host | `search5.truecaller.com`, `search5-eu.truecaller.com`, `search5-noneu.truecaller.com` |
| `type` | `2`, `4`, `19`, `20` (then `33`/`45` only if relevant) |
| `q` | E164 with `%2B`, E164 without `+`, national format |
| `countryCode` | captured value, uppercase ISO2, empty/omitted |
| `encoding` | `json`, omitted |
| `Accept` | `application/x-protobuf`, `application/json` |

Host variants are defined at
`truecaller_jadx/sources/com/truecaller/common/network/util/KnownEndpoints.java:18,112-126`.
`encoding=json` and Bearer are injected at
`truecaller_jadx/sources/p000/pg4.java:123-130`.
Observed `type` values are listed in `TRUE_CALLER_ENDPOINTS.md` section 3.

Record for each request:

- HTTP status and `tc-event-id`,
- content type,
- body length and sha256,
- decoded name/spam fields if parseable,
- whether a missing/invalid token produces 401/403 or a different error shape.

Do not brute-force other people's numbers. Use a small controlled set.

---

## 5. Questions this plan must answer

1. Does lookup work without a registered/signed-in account?
2. Which token is actually sent: cross-domain `auth_token_cross_domain`, exchanged
   installation ID, or `featureClientAuthV2` output?
3. Is `featureClientAuthV2` enabled on the tested build?
   Static checks: `truecaller_jadx/sources/p000/pg4.java:98`,
   `truecaller_jadx/sources/p000/mdt.java:76`, `truecaller_jadx/sources/p000/i4z.java:54`.
4. Which `type` yields the cleanest name+spam result for a normal phone number?
5. Does the app rewrite `search5.truecaller.com` to a regional/edge host for the test
   number? Hooks: `truecaller_jadx/sources/p000/b920.java:233-255`,
   `truecaller_jadx/sources/p000/ifh.java:80-95`,
   `truecaller_jadx/sources/p000/kfh.java:136-142`.
6. Is the `[FileCR]` mod affecting auth/signature? Ideally compare with an official build
   after the first successful capture.

---

## 6. Success criteria

The static candidate is confirmed when at least one replayed request:

1. returns HTTP 200 with a `ContactDto`-shaped body,
2. contains a recognizable name and/or spam fields listed in
   `truecaller_jadx/sources/com/truecaller/search/ContactDto.java:31-33,42-166,1680-1708,2419-2452`,
3. uses the reconstructed `GET /v2/search?q=...&countryCode=...&type=...&encoding=json`
   shape, and
4. has a reproducible token source documented from the hooks.

After that, update `TRUE_CALLER_ENDPOINTS.md` with the verified request and remove the
"static candidate" warning. Only then wire the browser-only Next.js client that reads
user-pasted secrets from localStorage; no server API route or server-held secret should be
added.
