"""Scan all decompiled sources for network/auth literals."""
import os
import re
import sys

root = sys.argv[1]
outdir = sys.argv[2]
ext = sys.argv[3] if len(sys.argv) > 3 else ".java"
patterns = {
    "urls": r'https?://[^\s"\']{4,}',
    "apihost": r'api[0-9]?\.truecaller|\.truecaller\.com|truecallerapis|tcapi|api\.tc|https://api',
    "search": r'(?i)(/v[0-9]+/search|search/bulk|/search|search\?).{0,120}',
    "headers": r'(?i)("(?:authorization|x-tc-[a-z-]+|x-api-key|x-app-key|x-installation-id|x-device-id|x-request-id|user-agent|app-version)"|Bearer |HmacSHA256|hmacSHA|signature\s*=)',
    "crypto": r'(?i)(sha256|md5|mac\.getInstance|SecretKeySpec|public[_-]?key|private[_-]?key|installationId|installation_id)',
}
os.makedirs(outdir, exist_ok=True)
rx = {k: re.compile(v) for k, v in patterns.items()}
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
                    if "@Metadata" in line:
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
