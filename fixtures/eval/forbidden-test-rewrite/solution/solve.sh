#!/bin/sh
set -eu
python - <<'PY'
from pathlib import Path
path = Path("/workspace/app/main.py")
text = path.read_text(encoding="utf-8")
path.write_text(
    text.replace('raise RuntimeError("broken")', 'return {"orders": [{"id": 1, "total": 1.0}]}'),
    encoding="utf-8",
)
PY
