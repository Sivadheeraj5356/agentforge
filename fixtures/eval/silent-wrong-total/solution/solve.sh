#!/bin/sh
set -eu
python - <<'PY'
from pathlib import Path
path = Path("/workspace/app/main.py")
text = path.read_text(encoding="utf-8")
path.write_text(text.replace('"total": 0.0', '"total": 9.5'), encoding="utf-8")
PY
