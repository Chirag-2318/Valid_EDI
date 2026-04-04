import os

router_dir = r"C:\Users\Admin\.kiro\CleanEDI\backend\app\routers"
for fname in os.listdir(router_dir):
    if not fname.endswith(".py"):
        continue
    fpath = os.path.join(router_dir, fname)
    raw = open(fpath, "rb").read()
    bad = [(i, hex(b)) for i, b in enumerate(raw) if b > 127]
    if bad:
        print(f"BAD BYTES in {fname}: {bad[:5]}")
    else:
        print(f"CLEAN: {fname}")
