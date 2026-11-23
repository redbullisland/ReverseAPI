# TrueCaller — auth value, testing routes, and build notes (2026-11-23)

This file records findings made **after** `TRUE_CALLER_ENDPOINTS.md` and `DYNAMIC_PLAN.md`
were written. All paths are relative to `D:\ReverseAPI`.

## 1. The Bearer value is `installationId` — server-issued, not self-generated

Earlier we assumed the `Authorization: Bearer <...>` value was an account token requiring a
signed-in user. Closer reading shows it is the **installationId**:

- `truecaller_jadx/sources/p000/pg4.java:122-130`
  - Reads `dd70.m51831e().f97680a` and sets `Authorization: Bearer <value>`.
  - Also adds `encoding=json` to the query string.
- `truecaller_jadx/sources/p000/C12032ec.java:10,18-24,54-56`
  - The class is `AccountState(installationId=<f97680a>, primaryPhoneNumber=..., secondaryPhoneNumber=...)`.
  - So `f97680a` is the **installationId**, not a password-derived token.
- `truecaller_jadx/sources/p000/dd70.java:374-390`
  - `m51831e()` reads SharedPreferences keys `installationId`, `profileNumber`,
    `profileCountryIso`, `secondary_country_code`, `secondary_normalized_number`.
  - If any required key is missing it calls `m51827a()` (restore from backup file).
- `truecaller_jadx/sources/p000/dd70.java:483-489`, `pl4.java:1337-1343`, `r2y.java:118-119`,
  `com/truecaller/account/network/{TokenResponseDto,CheckCredentialsResponseSuccessDto,ExchangeCredentialsResponseDto}.java`
  - The installationId arrives **from the server** in OTP / credential-check / exchange responses.
  - It is stored with `installationIdFetchTime` and `installationIdTtl` (`dd70.java:674-677`).

**Conclusion:** there is no local formula for the installationId. Static analysis cannot produce
a usable value. This is exactly why the Eyecon CID also had to come from the phone's user data.

## 2. Tried and failed: minting an installationId via the exchange endpoint

`truecaller_jadx/sources/p000/C13046pb.java:24-29` calls the exchange endpoint with
`AuthRequirement.NONE` (meaning no Bearer header is added):

```http
POST https://account.truecaller.com/v1/credentials/exchange
Content-Type: application/json
{"installationId":"<existing id>"}
```

- Route: `truecaller_jadx/sources/p000/InterfaceC13125rb.java:74-77`
  (`@e8v("/v1/credentials/exchange")`).
- Request DTO: `com/truecaller/account/network/ExchangeCredentialsRequestDto.java:10-23`
  — single field `installationId`.
- Host variants: `account`, `account-eu`, `account-noneu`
  (`com/truecaller/common/network/util/KnownEndpoints.java:39`).

Live test on 2026-11-23 with an arbitrary `test-id-12345678-abcdef`:

| Host | Result |
|---|---|
| `account.truecaller.com` | HTTP 000 (connection failed from this network) |
| `account-noneu.truecaller.com` | **401** `{"status":40101,"message":"Invalid credentials"}` |
| `account-eu.truecaller.com` | **401** `{"status":40101,"message":"Invalid credentials"}` |

So although no Bearer header is needed, the endpoint still validates the installationId
(and/or app-level signing). **We cannot mint our own.** A signed-in app is required.

## 3. Other capture routes tried

- `adb -s jnroyp6tjzztqwfm backup -nosystem -f truecaller_backup.ab com.truecaller`
  - User approved on device; result was a 47-byte empty archive. The manifest has
    `android:allowBackup="true"` plus `android:backupAgent="com.truecaller.TruecallerBackupAgent"`
    and `fullBackupOnly="true"`, so the custom agent excluded auth data.
- Existing `logcat_phone.txt` (30 MB):
  - No TrueCaller Bearer/installationId values. The `Token=CAM...` hit was a
    Google Play Services `PhenotypeModule` `serverToken`, unrelated.
- Stock app is **not debuggable** (`run-as com.truecaller` → "package not debuggable").
- Stock app trusts user CAs only under `<debug-overrides>`
  (`truecaller_apktool/res/xml/network_security_config.xml:3-7`) → stock MITM won't work.

## 4. Debuggable rebuild — built and ready

`truecaller_debuggable.apk` (113 MB) was built successfully and is on disk (gitignored).

Recipe used:

```bash
# truecaller_apktool/AndroidManifest.xml edits:
#   1. add android:debuggable="true" to <application>
#   2. strip android:usesPermissionFlags="0x20000" from the two location permissions
#      (local apktool framework cannot parse that newer flag)
java -jar /c/Users/redbull/Tools/apktool/apktool.jar b truecaller_apktool \
  -o truecaller_debuggable_unsigned.apk
/c/Users/redbull/AppData/Local/Android/Sdk/build-tools/35.0.0/apksigner.bat sign \
  --ks debug.keystore --ks-pass pass:android --key-pass pass:android \
  --out truecaller_debuggable.apk truecaller_debuggable_unsigned.apk
```

Verification:

```
versionName='26.43.5'  targetSdkVersion:'37'
A: android:debuggable(0x0101000f)=(type 0x12)0xffffffff
```

First build failed with `error: '0x20000' is incompatible with attribute usesPermissionFlags`;
second failed with `duplicate attribute` because the flag had already been applied once.
Both were fixed by normalizing the manifest to exactly one `android:debuggable` and removing
the two `usesPermissionFlags` attributes. Note: the decompiled manifest currently retains
`android:debuggable="true"` (the tree is gitignored and regenerable).

Install caveat: signed with `debug.keystore`, so it **cannot** be installed over the stock
app — `adb uninstall com.truecaller` is required first, which wipes the signed-in state.
The user must sign in again (OTP) and perform one search before `run-as com.truecaller` can
read the SharedPreferences value.

## 5. Tried and failed: public web search without a token

Hoping for a no-secret route, the public website was checked:

| URL | Result |
|---|---|
| `https://www.truecaller.com/api/search?q=...` | **404** JSON `Page not found` |
| `https://www.truecaller.com/search/bd/01632027018` | 200 HTML, but the name is **not** server-rendered; only locale/SEO links contain the number |
| `https://truecaller-web-directory.pages.dev/directory/search/bd/01632027018` | 200 HTML, but shows a **login wall** (`tc_user` cookie / `tc:user` localStorage token, `login=phone`) |

The Astro JS bundles (`SearchBar.DA6Vlleu.js`, `BaseLayout...js`) contain no directly
callable public API. **The web path needs its own OTP login token too** — no shortcut.

## 6. LIVE VERIFICATION — SUCCESS (2026-11-23)

The debuggable APK was installed via `MSYS_NO_PATHCONV=1 adb push ... /data/local/tmp/tc.apk`
followed by `adb shell pm install -r /data/local/tmp/tc.apk` (a direct `adb install` was
blocked by MIUI with `INSTALL_FAILED_USER_RESTRICTED`). The user signed in with OTP and
searched `01632-027018`.

`run-as com.truecaller cat shared_prefs/account.xml` yielded:

```xml
<string name="installationId"><value></string>
<string name="profileCountryIso">BD</string>
<string name="profileNumber">+880<redacted></string>
<string name="networkDomain">noneu</string>
<long name="installationIdTtl" value="259200000" />   <!-- 72 hours -->
```

**Never commit the real installationId.** It is a credential tied to the user's account and
expires after 72 hours (TTL above). Users must paste their own into the app.

### Confirmed request (HTTP 200)

```http
GET https://search5.truecaller.com/v2/search
    ?q=%2B8801632027018&countryCode=BD&type=2&encoding=json
Authorization: Bearer <installationId>
Accept: application/json
```

Tested matrix — all returned HTTP 200 with identical `"name":"Tasif"`:

| Host | type | Result |
|---|---|---|
| `search5-noneu.truecaller.com` | 2 | 200, `Tasif` |
| `search5-noneu.truecaller.com` | 4 | 200, `Tasif` |
| `search5.truecaller.com` | 2 | 200, `Tasif` |
| `search5.truecaller.com` | 4 | 200, `Tasif` |

So the static-derived request shape is **correct**. `search5` and `search5-noneu` both work;
the app's own `networkDomain=noneu` is not required for this number. `Accept: application/json`
works — no protobuf decoder needed.

### Confirmed response shape (actual JSON keys)

```json
{
  "data": [{
    "id": "...", "name": "Tasif", "score": 0.306,
    "access": "PUBLIC", "enhanced": true,
    "phones": [{ "e164Format": "+8801632027018", "nationalFormat": "01632-027018",
                 "dialingCode": 880, "countryCode": "BD",
                 "carrier": "Robi Axiata Limited", "numberType": "MOBILE", "type": "openPhone" }],
    "addresses": [{ "countryCode": "BD", "timeZone": "+06:00", "type": "address" }],
    "feedback": { "commentCount": 0, "feedbackType": "None" },
    "commentsStats": { "showComments": false },
    "isFraud": false,
    "electedTags": [], "badges": [], "tags": [], "sources": [], "searchWarnings": [],
    "manualCallerIdPrompt": false, "ns": 7
  }],
  "provider": "ss-nu",
  "stats": { "sourceStats": [] }
}
```

Important correction to the static doc: the live response uses **`isFraud`** and
**`feedback.feedbackType`** (e.g. `"Spam"`, `"Fraud"`, `"None"`) for spam/fraud — there is no
`spamInfo` object in this response. `app/src/lib/providers/truecaller.js` was updated to parse
these real fields (while still tolerating the older `spamInfo` / `isSuspectedFraud` variants).

## 7. What the Next.js app needs

Only one value: the installationId, pasted into the **Bearer token** field in
`app/src/lib/providers/truecaller.js`. Everything else is already known:

```text
GET https://search5.truecaller.com/v2/search
    ?q=%2B<e164>&countryCode=<ISO2>&type=2&encoding=json
Authorization: Bearer <installationId>
Accept: application/json
```

If the installationId is obtained, verify these remaining variables against a real response:
host (`search5` / `search5-eu` / `search5-noneu`), `type` (`2` first, then `4`),
and `Accept` (`application/json` vs `application/x-protobuf`).
