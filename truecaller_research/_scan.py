"""Fast recursive regex scanner used for static analysis of decompiled trees."""
import os
import re
import sys

root, pattern, ext = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else ".java")
rx = re.compile(pattern, re.I)
count = 0
for dirpath, _, files in os.walk(root):
    for name in files:
        if not name.endswith(ext):
            continue
        path = os.path.join(dirpath, name)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh, 1):
                    if rx.search(line):
                        print(f"{path}:{i}:{line.rstrip()}")
                        count += 1
        except OSError:
            pass
print(f"# MATCHES={count}", file=sys.stderr)
