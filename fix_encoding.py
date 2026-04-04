import os, sys

router_dir = r"C:\Users\Admin\.kiro\CleanEDI\backend\app\routers"
for fname in os.listdir(router_dir):
    if not fname.endswith(".py"):
        continue
    fpath = os.path.join(router_dir, fname)
    raw = open(fpath, "rb").read()
    # decode as windows-1252, re-encode as utf-8
    try:
        text = raw.decode("utf-8")
        print(f"ALREADY UTF8: {fname}")
    except UnicodeDecodeError:
        text = raw.decode("windows-1252", errors="replace")
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"FIXED: {fname}")
