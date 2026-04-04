fpath = r"C:\Users\Admin\.kiro\CleanEDI\backend\app\routers\copilot.py"
raw = open(fpath, "rb").read()
# Replace UTF-8 em dash (e2 80 94) with ASCII dash
fixed = raw.replace(b"\xe2\x80\x94", b"-")
open(fpath, "wb").write(fixed)
# Verify
import ast
text = open(fpath, encoding="utf-8").read()
ast.parse(text)
print("copilot.py: syntax OK")
