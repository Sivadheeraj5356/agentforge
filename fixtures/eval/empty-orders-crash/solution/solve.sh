#!/bin/sh
set -eu
python - <<'PY'
from pathlib import Path
path = Path("/workspace/app/main.py")
text = path.read_text(encoding="utf-8")
path.write_text(text.replace("return {\"orders\": ORDERS[0]}", "return {\"orders\": ORDERS}"), encoding="utf-8")
PY
