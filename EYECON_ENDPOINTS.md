# Eyecon Caller ID & Spam Block — decompilation / endpoint map

APK: `Eyecon Caller ID & Spam Block v4.2026.08.27.2228 [FileCR].apk`
A temporary `eyecon_tool.apk` copy is used for tools because the original `&` breaks
the apktool wrapper at exit; `README.md` creates and deletes it around each regeneration.

Package: `com.eyecon.global`
Launcher activity: `com.eyecon.global.MainScreen.MainActivity`

Outputs:
- `eyecon_jadx/` — jadx `--deobf` sources (57,115 Java files)
- `eyecon_jadx_badcode/` — jadx `--deobf --show-bad-code` (same file count, 514 reported errors)
- `eyecon_apktool/` — apktool decode (AndroidManifest, res, 9 smali dex sets)

---

## 1. Base URLs and constants

```java
// eyecon_jadx/sources/com/eyecon/global/Others/Cons.java:613
f24233O1 = "https://api.eyecon-app.com/app/";

// eyecon_jadx/sources/com/eyecon/global/Network/ApiEndpointConfig.java:114-121
f23940a = "https://api.eyecon-app.com/app/";
f23941b = "api.eyecon-app.com";
api.eyecon-app.com   -> 108.128.242.94
cards.eyecon-app.com -> 34.251.68.80
cache TTLs: 2 hours / 5 minutes
```

`Cons.f24260a` is **not** a URL. It is a local file path (Cons.java:466):

```text
/.Eyecon/.nomedia
```

`Server.m15875l()` (Server.java:946-953) returns the API base with the host swapped for
the Firebase Remote Config value `api_hostname` — so effectively the same base, but overridable.

---

## 2. First-party API paths under `https://api.eyecon-app.com/app/`

| Path | Method / notes | Source |
|---|---|---|
| `cantalk.jsp` | GET | CanTalkStatusMgr.java:92, AsyncTaskCalls.java:38 |
| `getcantalkstatus.jsp` | GET | CanTalkStatusMgr.java:173 |
| `cantalksaw.jsp` | GET, dynamic path arg | CanTalkActivity.java:450 |
| `cantalkreceived.jsp` | GET, dynamic path arg | PushHandler.java:512 |
| `updateuserdetails.jsp` | GET | Server.java:306,309; RunnableC8495e.java:107,172,198,218; RunnableC8468q.java:268 |
| `addcontacts.jsp` | POST, gzip | Server.java:499-510 |
| `getcontactslang.jsp` | GET | Server.java:500,531 |
| `removecontacts.jsp` | POST | Server.java:814-818 |
| `getnames.jsp` | GET | Server.java:858; RunnableC8493c.java:232 |
| `getfreshpicsjson.jsp` | GET | RunnableC8493c.java:116 |
| `getoptionalpics.jsp` | GET | RunnableC8496f.java:60 |
| `pic?cli=<num>&is_callerid=true&size=<size>&type=0&src=<src>&cancelfresh=0&cv=...` | image fetch | Server.java:933-942 |
| `uploadpic.jsp` | upload | Server.java:453 |
| `notifyaddcontact.jsp` | GET | RunnableC8492b.java:44 |
| `addhashes.jsp` | GET | RunnableC8491a.java:163 |
| `addfbtoken.jsp` | GET | RunnableC8495e.java:147 |
| `social_auth/validatetoken` | GET | RunnableC8491a.java:108 |
| `social_auth/use_cli_validation` | GET | RunnableC8496f.java:175 |
| `cli_auth/checkcode` | GET | Server.java:982-988 |
| `grps/sgn` | POST, encrypted body | Server.java:263 |
| `eventreport.jsp` | POST, urlencoded | RunnableC8497g.java:44 |
| `spamreport` | POST | Server.java:1074,1108 |
| `spam` | GET | RunnableC8496f.java:130 |
| `spam_sms/report` | POST, JSON | RunnableC8498h.java:71; RunnableC8468q.java:232 |
| `messages/get` | GET | RunnableC8501k.java:307 |
| `messages/received` | POST, JSON | Server.java:1154 |
| `share` | GET/POST | RunnableC8501k.java:156; RunnableC8491a.java:219 |
| `get_store_products` | GET | RunnableC8501k.java:57 |
| `mysettings` | GET | RunnableC8501k.java:107; RunnableC8496f.java:134 |
| `virality/viral_id` | GET | RunnableC8501k.java:128 |
| `virality/viral_id_check` | GET | RunnableC8501k.java:260 |
| `virality/premium_status` | GET | RunnableC8501k.java:331 |
| `resuggest_name` | POST, JSON | Server.java:1298 |
| `social-mngr` | built at Server.java:1179 | Server.java:1179 |
| `name_report` | GET | DynamicArea/RunnableC8132b.java:76 |
| `shorten-url` | GET | RunnableC8496f.java:88 |
| `pub/su/<id>` | short-link output | RunnableC8496f.java:104 |
| `pub/redirectme.jsp?goto=<urlencoded>` | GET | Location/ShareMyLocation.java:115 |
| `deleteme.jsp` | GET | RunnableC8501k.java:287 |
| `getupdatedcontactsinfo.jsp` | GET | RunnableC8491a.java:244 |
| `resetupdatedstatus.jsp` | GET | RunnableC8468q.java:204 |

---

## 3. Voice-to-text service

Base: `https://voice2text.eyecon-app.com/`

```text
init-ttm                     POST   RunnableC8494d.java:51
ack                          POST   RunnableC8494d.java:73
no-ttm                       POST   RunnableC8492b.java:58
start-ttm                    POST   p005a2/RunnableC0026e0.java:410
ttm-get-tokens-amount        GET    RunnableC8501k.java:85
ttm-test-call-forwarding     POST   RunnableC8501k.java:182
ttm-call-forwarding-result   GET    RunnableC8501k.java:208
getText                      GET    RunnableC8501k.java:234
```

---

## 4. Other first-party hosts

```text
https://cards.eyecon-app.com/getCards/                 DynamicAreaServerDataLoader.java:73
https://cloudfront-cdn.eyecon-app.com/app_data/sms_spam_keywords/sms_spam_keywords.txt
https://cloudfront-cdn.eyecon-app.com/app_data/sms_spam_keywords/senders_white_list.txt
https://apps.eyecon-app.com/call-contest/a/report-calls  FireRemoteConfig.java:371
https://www.eyecon-app.com/                             webview base / FAQ / legal
https://faq.eyecon-app.com/...                          many help URLs
https://eyecon-app.com/vrs/evid-<id>                    Billing/FreePremium.java:95,100
http://join.eyecon-app.com/                             Singular branded domain
ptt.eyecon-app.com                                      TokiFragment.java:755,2586
https://update.9mod.com/<package>.txt                   p000/Xpk8a.java:75  (mod updater)
http://numberlookup.instabridge.com/                    MessageAssistantDependencies.java:115
https://workers.degoo.com/location                      Others/RunnableC8796b.java:80
https://us1.locationiq.com/v1/search.php
https://eu1.locationiq.com/v1/search.php
```

---

## 5. Firebase Remote Config keys (defaults)

`FireRemoteConfig.java`

| Key | Default |
|---|---|
| `eyecon_remote_config_url` | `http://d3obo2yu5tpnfw.cloudfront.net/configs/ab-test.txt` |
| `api_hostname` | `api.eyecon-app.com` |
| `api_ips` | `["108.128.242.94"]` |
| `cards_ips` | `["34.251.68.80"]` |
| `dynamic_area_url` | `cards.eyecon-app.com` |
| `server_report_url` | empty (overridable) |
| `analytics_worker_url` | `disabled_by_remote` |
| `store_download_url` | empty (overridable) |
| `store_url` | empty (overridable) |
| `script_facebook_profile_validate` | empty (overridable) |
| `ac_ads_test_internet_connection_url` | `https://www.google.com` |
| `call_contest_report_calls_url` | `https://apps.eyecon-app.com/call-contest/a/report-calls` |

`EyeconRemoteConfig.java:81` fetches `eyecon_remote_config_url` and stores the JSON in
`SP_KEY_EYECON_REMOTE_CONFIG_SERVER_RAW`. This means the live endpoint set can differ
from the hardcoded values above.

---

## 6. Request crypto

`Network/Encrypt.java`:

1. Generate random 256-bit key.
2. Use it as a **Blowfish** key to encrypt the payload → Base64.
3. Encrypt that key with **RSA/ECB/PKCS1Padding** using the embedded public key → Base64.
4. Return `base64(RSA(key)) + "#" + base64(Blowfish(payload))`.

`Network/Decrypt.java` reverses this. `grps/sgn` uses this wrapper (Server.java:263).

---

## 7. Deobfuscation notes

- Real package/class names survived; jadx renamed only heavily obfuscated classes to
  `Cxxxx` / `AbstractCxxxx` and fields to `f12345a`, keeping original names in
  `/* JADX INFO: renamed from: a */` comments.
- 513 errors in the normal pass, 514 with `--show-bad-code`. The extra pass produced the
  same 57,115 files; the checked broken method `ApiEndpointConfig$1.lookup` still ends in
  `throw null;`. For genuinely broken methods, read smali:
  `eyecon_apktool/smali_classes4/com/eyecon/global/Network/ApiEndpointConfig$1.smali`
- If you need raw bytecode-level output instead, use:
  `jadx --deobf --decompilation-mode fallback -d eyecon_jadx_fallback eyecon_tool.apk`
- Mod artifacts: `p000/Xpk8a.java` (9mod updater) and
  `bin/p020mt/signature/pokie.java` referencing `ApkSignatureKillerEx` confirm this is a
  repackaged/modded APK, not a stock Play Store build.

---

## 8. Third-party infrastructure seen in the host scan

Top repeated hosts: `googleads.g.doubleclick.net`, `cdn2.inner-active.mobi`,
`pubads.g.doubleclick.net`, `pagead2.googlesyndication.com`, `api.stripe.com`,
`sdk-api-v1.singular.net`, `logs.adster.tech`, `remote-config.adster.tech`,
`lf-static.tiktokpangle-cdn-us.com`, `c.amazon-adsystem.com`, `app-measurement.com`,
`js.hcaptcha.com`, `prod.uidapi.com`, `crackle.tech`, `supply.inmobicdn.net`.

---

## 9. Live remote-config fetch (checked 2026-11-22)

Fetched `http://d3obo2yu5tpnfw.cloudfront.net/configs/ab-test.txt` — it is currently only
an A/B-test configuration (versionCode `149`) with experiment names such as
`FINAL_DECISIONS_DONT_DELETE`, `draw_above_onboarding_abcd`, `old_versions_support`,
`happy_flow_IN_final_decision`, and `debug_test`. It does **not** currently override
`api_hostname`, `api_ips`, or `cards_ips`, so the hardcoded hosts above still apply.

Firebase Remote Config itself (not this CloudFront file) remains the place where
`api_hostname`, `api_ips`, `cards_ips`, `dynamic_area_url`, `store_url`, etc. can be
changed at runtime.
