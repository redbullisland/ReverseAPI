"""Raw byte search across a directory tree (including binaries), prints context."""
import os
import re
import sys

root, pattern = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 200
rx = re.compile(pattern.encode(), re.I)
found = 0
for dirpath, _, files in os.walk(root):
    for name in files:
        path = os.path.join(dirpath, name)
        try:
            with open(path, "rb") as fh:
                data = fh.read()
            for m in rx.finditer(data):
                a = max(0, m.start() - 90)
                b = min(len(data), m.end() + 130)
                ctx = data[a:b].replace(b"\n", b" ").replace(b"\r", b" ")
                print(f"{path}:+{m.start()}:{ctx!r}")
                found += 1
                if found >= limit:
                    print("# LIMIT REACHED")
                    sys.exit(0)
        except OSError:
            pass
print(f"# FOUND={found}")
