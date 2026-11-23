# TrueCaller v26.43.5 — name + spam lookup endpoint map

Scope: **name/spam lookup only**. Messaging, social, and photo endpoints are out of scope.

All source paths below are relative to `D:\ReverseAPI\`.

## 0. Artifacts and confidence

- Target APK: `Truecaller - Phone Call Blocker v26.43.5 [FileCR].apk`.
- Package/version: `com.truecaller`, `versionCode 2643005`, `versionName 26.43.5`
  (`truecaller_apktool/apktool.yml:2`, `truecaller_apktool/apktool.yml:10-11`).
- Manifest package and app class: `truecaller_apktool/AndroidManifest.xml:2`,
  `truecaller_apktool/AndroidManifest.xml:207`.
- apktool completed successfully: `APKTOOL_EXIT=0`
  (`truecaller_research/apktool_decompile.log:1-22`), producing 10 smali sets.
- jadx completed but with decompiler errors: **1,241 errors, `JADX_EXIT=3`**
  (`truecaller_research/jadx_decompile.log:3-4`). The normal JADX tree contains 76,914
  Java files; it is usable for readability, but **apktool smali is ground truth** wherever
  JADX restructures or fails a method.
- **LIVE-VERIFIED on 2026-11-23.** The debuggable rebuild was installed on the Xiaomi device,
  signed in, and a real search for `+8801632027018` returned HTTP 200 with `"name":"Tasif"`
  from both `search5` and `search5-noneu` for `type=2` and `type=4`. See
  `truecaller_research/AUTH_AND_TESTING_FINDINGS.md` §7 for the confirmed request/response.
  The static map below was correct; only the auth value (`installationId`) had to come from
  the device. The original dynamic plan is retained in `truecaller_research/DYNAMIC_PLAN.md`.

---

## 1. Primary name/spam lookup endpoint

The search Retrofit interface is `tb20`. It declares five routes, all with
`Accept: application/x-protobuf`:

| Method | Route | Purpose |
|---|---|---|
| `m86095a` | `/v2/bulk` | bulk lookup, out of scope |
| `m86096b` | `/v2/search` | **primary single-number/name lookup** |
| `m86097c` | `/v2/im/search` | IM search, out of scope |
| `m86098d` | `/v2/im/bulk` | IM bulk, out of scope |
| `m86099e` | `/v2/search/private` | private-ID lookup, out of scope |

Sources: `truecaller_jadx/sources/p000/tb20.java:14-43`; smali ground truth:
`truecaller_apktool/smali_classes8/tb20.smali:71,76`, `:130,135`, `:175,180`, `:218,223`,
`:253,258`.

The primary signature is:

```java
yq7<ContactDto> m86096b(
    @b5z("q") String query,
    @pu50 kf00 targetDomain,
    @b5z("countryCode") String countryCode,
    @b5z("type") String type
);
```

`truecaller_jadx/sources/p000/tb20.java:21-25`; smali parameter annotations and route at
`truecaller_apktool/smali_classes8/tb20.smali:100-137`.

### Reconstructed request

```http
GET https://search5.truecaller.com/v2/search
    ?q=<query>
    &countryCode=<ISO2>
    &type=<int-as-string>
    &encoding=json
Accept: application/x-protobuf
Authorization: Bearer <token>
```

Notes:

- `q`, `countryCode`, `type`, and the path come from Retrofit
  (`truecaller_jadx/sources/p000/tb20.java:21-25`).
- `encoding=json` is **not** declared on `tb20`; it is added by the auth interceptor when a
  token is available (`truecaller_jadx/sources/p000/pg4.java:123-130`;
  `truecaller_apktool/smali_classes5/pg4.smali:333-337`).
- `Authorization: Bearer ...` is added by the same interceptor
  (`truecaller_jadx/sources/p000/pg4.java:127-129`;
  `truecaller_apktool/smali_classes5/pg4.smali:98,351-357`).
- The `Accept: application/x-protobuf` header is declared on every `tb20` route
  (`truecaller_jadx/sources/p000/tb20.java:15,21,27,33,39`).
- The response is converted from protobuf into `ContactDto` through the custom converter
  stack installed on the search client (`truecaller_jadx/sources/p000/kb20.java:31,40`,
  `truecaller_jadx/sources/p000/jqy.java:22-33`, `truecaller_jadx/sources/p000/v07.java:23-34`).

### `search5`, not `api4`

The search client is built with `KnownEndpoints.SEARCH`
(`truecaller_jadx/sources/p000/kb20.java:25-32` and `:36-41`). `SEARCH` is defined as
`("search5", "search5-eu", "search5-noneu")`
(`truecaller_jadx/sources/com/truecaller/common/network/util/KnownEndpoints.java:18`).
`API` is a separate endpoint defined as `("api4", "api4-eu", "api4-noneu")`
(`truecaller_jadx/sources/com/truecaller/common/network/util/KnownEndpoints.java:29`).

Therefore the lookup call site is `search5*.truecaller.com/v2/search`, not
`api*.truecaller.com`. A bytesearch of the apktool tree for `api[0-9]?.truecaller.com`
returned no matches (`truecaller_research/_bytes_api4.txt:1`).

---

## 2. Host variants and region selection

`KnownEndpoints.url()` builds `https://<key>.truecaller.com`, giving the default base
`https://search5.truecaller.com/`
(`truecaller_jadx/sources/com/truecaller/common/network/util/KnownEndpoints.java:134-138`;
called from `truecaller_jadx/sources/p000/ns0.java:41-46`).

Regional hosts are available through `getHost(KnownDomain)`:

- `DOMAIN_REGION_1` -> `eu`
- `DOMAIN_OTHER_REGIONS` -> `noneu`

Sources: `truecaller_jadx/sources/com/truecaller/common/network/KnownDomain.java:11-13`
and `truecaller_jadx/sources/com/truecaller/common/network/util/KnownEndpoints.java:112-126`.
For `SEARCH`, those resolve to `search5-eu.truecaller.com` and
`search5-noneu.truecaller.com`.

The per-request domain marker `kf00` is computed in `b920.m6469e()`:
`if00` means default/no specific region; `jf00(KnownDomain)` is used when the parsed
number has a valid region that differs from the app's current region
(`truecaller_jadx/sources/p000/b920.java:233-255`).
`jf00` holds a `KnownDomain` (`truecaller_jadx/sources/p000/jf00.java:6-14`) and `if00`
is the singleton default (`truecaller_jadx/sources/p000/if00.java:3-8`).

The EU-region list used by `s3m.m83216h()` is a lazy list reached via
`ivz.f125087a` (`truecaller_jadx/sources/p000/s3m.java:1301-1313`,
`truecaller_jadx/sources/p000/ivz.java:7-11`). The app's current region comes from
`vhg.m90835a()` / `vhg.m90836b()` (`truecaller_jadx/sources/p000/vhg.java:34-51`).

A host rewrite interceptor can replace the URL host when a specific `jf00` or app region
maps to an edge host (`truecaller_jadx/sources/p000/ifh.java:80-95`). The fallback edge map
is built from `KnownEndpoints.getHost(KnownDomain)` for every endpoint
(`truecaller_jadx/sources/p000/g8h.java:58-64`), and lookup uses `kfh.m66478c()`
(`truecaller_jadx/sources/p000/kfh.java:136-142`).

Practical implication: test all three hosts during live verification; do not assume only
`search5.truecaller.com`.

---

## 3. Query parameters and number handling

### `q`

`b920.m6466b()` validates that `type != 999` and that `q` is non-empty, stringifies the
type, and calls `m86096b(q, targetDomain, countryCode, type)`
(`truecaller_jadx/sources/p000/b920.java:176-192`).

The caller-ID flow normalizes the number to libphonenumber `E164` before setting `q`:

- `cfw.m9948c(str, profileCountryIso, PhoneNumberUtil.PhoneNumberFormat.E164)`
  (`truecaller_jadx/sources/p000/fd00.java:1073`).
- `cfw.m9948c()` parses with libphonenumber and formats to the requested format
  (`truecaller_jadx/sources/p000/cfw.java:43-60`).
- The normalized value is assigned to `f22514w` and `type = 2`
  (`truecaller_jadx/sources/p000/fd00.java:1078-1082`).

`q` is passed as the first Retrofit argument at
`truecaller_jadx/sources/p000/b920.java:187-192`. If E164 includes a leading `+`, URL-encode
it as `%2B` in a hand-built request.

### `countryCode`

`countryCode` is `b920.f22515x`:

- Explicit setter: `m6467c(String)` uppercases the supplied value with `Locale.ENGLISH`
  (`truecaller_jadx/sources/p000/b920.java:214-223`; `u7z.m88584N()` at
  `truecaller_jadx/sources/p000/u7z.java:348-355`).
- Default setter: `m6468d()` uses `ma3.m70801a().mo9291c()` and uppercases it
  (`truecaller_jadx/sources/p000/b920.java:225-231`).
- The app implementation of `mo9291c()` returns `dd70.m51832f()` or `""`
  (`truecaller_jadx/sources/p000/c870.java:193-198`).
- `dd70.m51832f()` returns `profileCountryIso`
  (`truecaller_jadx/sources/p000/dd70.java:393-400`; source fields read at
  `truecaller_jadx/sources/p000/dd70.java:379-387`).

So for an ordinary configured device, `countryCode` is the profile country ISO (uppercase),
not the dialing code.

### `type`

`type` is `String.valueOf(b920.f22513v)`
(`truecaller_jadx/sources/p000/b920.java:188-192`). Default is `999`, which is rejected
as "You must specify a search type" (`truecaller_jadx/sources/p000/b920.java:95-96`,
`:180`).

Observed call-site values (not a complete server-side enum):

| Value | Context | Source |
|---:|---|---|
| `2` | caller ID lookup; query normalized to E164 | `truecaller_jadx/sources/p000/fd00.java:1073-1082`; `truecaller_jadx/sources/p000/lq8.java:249-252` |
| `4` | global search / generic contact lookup | `truecaller_jadx/sources/p000/n5m.java:870-876`; `truecaller_jadx/sources/p000/bwl.java:2522-2525`; `truecaller_jadx/sources/p000/dwt.java:120-124` |
| `19` | notification-derived lookup | `truecaller_jadx/sources/p000/j8u.java:18-24` |
| `20` | participant/conversation lookup | `truecaller_jadx/sources/p000/iiv.java:42-50` |
| `33` | WhatsApp caller ID | `truecaller_jadx/sources/p000/ha80.java:1248-1255` |
| `45` | family protect lookup | `truecaller_jadx/sources/p000/jkc.java:80-87` |

`b920.m6466b()` also treats `20` and `43` specially for cache/write behavior
(`truecaller_jadx/sources/p000/b920.java:193-204`), so `43` is another real type value even
though no assignment was recorded in the scanned call sites.

Open question: which of `2`, `4`, `19`, or `20` is required for the exact name+spam use case
after live testing. Static analysis shows they are all valid client inputs, but their
server-side semantics are not named in the APK.

---

## 4. Authentication

### The search client is an authenticated client

`kb20.m66343a()` creates a Retrofit client with `KnownEndpoints.SEARCH`
(`truecaller_jadx/sources/p000/kb20.java:25-41`). When no client override is supplied,
`ns0.m74388c()` falls back to `n4n.f150548b`
(`truecaller_jadx/sources/p000/ns0.java:69-72`).

`n4n.f150548b` is a lazy client built from `rnm((byte) 19)`
(`truecaller_jadx/sources/p000/n4n.java:30-34`). That branch sets
`AuthRequirement.REQUIRED` (`truecaller_jadx/sources/p000/rnm.java:72-75`), which makes
`n4n.m72192a()` construct the `pg4` auth interceptor
(`truecaller_jadx/sources/p000/n4n.java:62-74`).

`ns0` also installs an `ylp` interceptor that tags each request with the `KnownEndpoints`
value (`truecaller_jadx/sources/p000/ns0.java:79-82`;
`truecaller_jadx/sources/p000/ylp.java:20-25`). `pg4` reads that tag and rejects unknown
domains (`truecaller_jadx/sources/p000/pg4.java:84-87`).

### Header injection

Once a token string is resolved, `pg4`:

1. Appends `encoding=json` to the URL query
   (`truecaller_jadx/sources/p000/pg4.java:123-126`;
   `truecaller_apktool/smali_classes5/pg4.smali:333-339`).
2. Adds `Authorization: Bearer <token>`
   (`truecaller_jadx/sources/p000/pg4.java:127-130`;
   `truecaller_apktool/smali_classes5/pg4.smali:98,351-357`).

If the request is marked cross-domain and no token is available, `pg4` throws
`NoCrossDomainTokenException` rather than sending anonymously
(`truecaller_jadx/sources/p000/pg4.java:131-141`). A required-auth request also errors
when credentials are not initialized (`truecaller_jadx/sources/p000/pg4.java:143-144`).

### Token source branches

`pg4` chooses among three static branches
(`truecaller_jadx/sources/p000/pg4.java:91-120`):

1. **Cross-domain token**: if the request carries `jf00` and the feature predicate is true,
   `pg4` calls `y660.m96010b()`
   (`truecaller_jadx/sources/p000/pg4.java:94-95`). The predicate is
   `lsd.m69796a()`: config flag plus `kf00 instanceof jf00`
   (`truecaller_jadx/sources/p000/lsd.java:15-18`).
   - `y660` requests a temporary token from `KnownEndpoints.ACCOUNT`
     (`truecaller_jadx/sources/p000/y660.java:43-67` and `:84-100`).
   - The token/TTL is stored as `auth_token_cross_domain`
     (`truecaller_jadx/sources/p000/y660.java:73-81`, `:106-114`).
   - Cached/refreshed retrieval is synchronized in `m96010b()`
     (`truecaller_jadx/sources/p000/y660.java:128-155`).

2. **Client-auth-v2**: when `featureClientAuthV2` is enabled and the request has a
   `KnownEndpoints` tag, `pg4` invokes `og4`
   (`truecaller_jadx/sources/p000/pg4.java:98-99`). `og4` calls `d30` with the endpoint key
   and current host (`truecaller_jadx/sources/p000/og4.java:54-58`). The flag is registered
   in `i4z.java:54` and checked with default `FeatureState.ENABLED_ALPHA_DEBUG`
   (`truecaller_jadx/sources/p000/pg4.java:98`; also
   `truecaller_jadx/sources/p000/mdt.java:76`). JADX did not recover a usable `d30` body,
   so verify this branch dynamically.

3. **Account/installation token**: otherwise `pg4` reads `dd70.m51831e().f97680a` and
   calls `dd70.m51837k(str)` when auth is required
   (`truecaller_jadx/sources/p000/pg4.java:100-118`).
   - `dd70.m51831e()` reads `installationId`, `profileNumber`, `profileCountryIso`, and
     secondary-number fields (`truecaller_jadx/sources/p000/dd70.java:373-390`).
   - `dd70.m51837k()` exchanges the installation ID via `C13046pb.m78067c(str)` and
     returns the exchanged installation ID when state is `STATE_EXCHANGED`
     (`truecaller_jadx/sources/p000/dd70.java:443-489`).

### What is not used on this path

- `X-TC-Token` appears in `truecaller_jadx/sources/p000/y2y.java:380` and
  `truecaller_apktool/smali_classes6/y2y.smali:1127`, but no link to the primary
  `/v2/search` call was found.
- `qi7.java:27-33` also adds a Bearer header, but it belongs to a different auth client;
  do not conflate it with `pg4`.
- No HMAC/signature query parameter or header was found on the `tb20`/`b920` search path.
  This is a negative static finding, not proof of absence under all builds/feature flags.

### Certificate / TLS note

The app declares `android:networkSecurityConfig="@xml/network_security_config"`
(`truecaller_apktool/AndroidManifest.xml:207`). That config trusts user CAs only inside
`<debug-overrides>` (`truecaller_apktool/res/xml/network_security_config.xml:3-7`). A stock
release build therefore should not trust a normal user-installed MITM CA. This is why the
dynamic plan uses a debuggable rebuild or an injected Gadget rather than stock
user-CA interception.

---

## 5. Response shape and fields

`tb20.m86096b()` returns `yq7<ContactDto>` (`truecaller_jadx/sources/p000/tb20.java:25`).
`ContactDto` has a root `data: List<Contact>` field
(`truecaller_jadx/sources/com/truecaller/search/ContactDto.java:31-33`,
`:3409`).

`b920` wraps the raw call in `tst`, optionally `pm7`, `rn1`, and `u43`
(`truecaller_jadx/sources/p000/b920.java:193-211`). `tst`:

- filters contacts whose `access` is not `public` unless a matching hidden local contact is
  allowed (`truecaller_jadx/sources/p000/tst.java:61-76`),
- maps via `yb20.m96204b()` (`truecaller_jadx/sources/p000/tst.java:77`),
- reads the `tc-event-id` response header and returns it with the contacts
  (`truecaller_jadx/sources/p000/tst.java:78-82`).

Name fields in `ContactDto.Contact`:

| JSON key | Source |
|---|---|
| `id` | `ContactDto.java:94-96` |
| `name` | `ContactDto.java:122` |
| `transliteratedName` | `ContactDto.java:162` |
| `altName` | `ContactDto.java:50` |
| `category` | `ContactDto.java:66` |
| `isSuspectedFraud` | `ContactDto.java:110-112` |
| `electedTags` | `ContactDto.java:74-76` |
| `verifiedNameSource` | `ContactDto.java:166` |
| `spamInfo` | `ContactDto.java:150` |
| `phones` | `ContactDto.java:130` |
| `tags` | `ContactDto.java:158` |

All paths above are under `truecaller_jadx/sources/com/truecaller/search/`.

Phone-level spam fields:

| JSON key | Source |
|---|---|
| `countryCode` | `ContactDto.java:1680` |
| `dialingCode` | `ContactDto.java:1684` |
| `e164Format` | `ContactDto.java:1688` |
| `nationalFormat` | `ContactDto.java:1696` |
| `spamScore` | `ContactDto.java:1704` |
| `spamType` | `ContactDto.java:1708` |

Contact-level `SpamInfo` fields:

| JSON key | Source |
|---|---|
| `spamScore` | `ContactDto.java:2419` |
| `spamStats` | `ContactDto.java:2423-2425` |
| `spamType` | `ContactDto.java:2427-2429` |
| `spamVersion` | `ContactDto.java:2431` |
| `numCalls60days` | `ContactDto.java:2442` |
| `numReports60days` | `ContactDto.java:2450` |

The app maps these into `Contact`/`Number`/`SpamInfoEntity` in
`truecaller_jadx/sources/com/truecaller/search/bar.java`:

- name/access/category/fraud/verified source: `:40-84`,
- phone E164/national format/spam score/spam type/dialing code: `:91-122`,
- contact spam score/type/stats: `:239-257`.

For a client-only integration, the practical output is:
`name`/`altName`, `phones[].e164Format`, `spamInfo.spamScore`, `spamInfo.spamType`,
and optionally `spamInfo.spamStats`.

---

## 6. Open questions before implementation

1. **Account requirement**: can a fresh installation with no registered/signed-in account
   obtain a usable Bearer token, or is a real TrueCaller account required?
2. **Active auth branch**: which of cross-domain token, `featureClientAuthV2`, or
   installation-ID exchange is actually used for `/v2/search` on a production build?
3. **`type` semantics**: which type value should the browser integration use for a plain
   name+spam lookup (`2` caller ID vs `4` global search vs `20` participant lookup)?
4. **Host selection**: does the backend require the region-specific
   `search5-eu`/`search5-noneu` host for some numbers, or does the default host work?
5. **Mod impact**: does the `[FileCR]` repackage alter signature/auth behavior compared with
   the official Play Store build?
6. **Response decoding**: confirm whether the body is protobuf for all three `Accept`
   variants and capture a raw sample for `protoc --decode_raw`.

Until these are answered dynamically, treat the reconstructed request above as a
**candidate**, not a guaranteed public API.
