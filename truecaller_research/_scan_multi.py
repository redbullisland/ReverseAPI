"""Multi-pattern recursive scanner for decompiled sources; skips Kotlin @Metadata noise."""
import os
import re
import sys

root = sys.argv[1]
outdir = sys.argv[2]
ext = sys.argv[3] if len(sys.argv) > 3 else ".java"
patterns = {
    "urls": r'"(?:https?:)?//[^"\s]+"',
    "searchpath": r'v1/search|/search|search/bulk|/lookup',
    "auth": r'X-TC|Authorization|Bearer|bearer|hmac|HmacSHA256|signature|nonce|timestamp',
    "apipath": r'api\d?\.truecaller|\.truecaller\.com|truecallerapis',
    "normalize": r'countryCode|country_code|normalize|PhoneNumberUtil|normalizeNumber',
}
os.makedirs(outdir, exist_ok=True)
rx = {k: re.compile(v, re.I) for k, v in patterns.items()}
counts = {k: 0 for k in patterns}
handles = {k: open(os.path.join(outdir, f"_{k}.txt"), "w", encoding="utf-8") for k in patterns}
for dirpath, _, files in os.walk(root):
    for name in files:
        if not name.endswith(ext):
            continue
        path = os.path.join(dirpath, name)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh, 1):
                    if "@Metadata" in line or line.lstrip().startswith("import "):
                        continue
                    for k, r in rx.items():
                        if r.search(line):
                            handles[k].write(f"{path}:{i}:{line.rstrip()}\n")
                            counts[k] += 1
        except OSError:
            pass
for h in handles.values():
    h.close()
print(counts)
