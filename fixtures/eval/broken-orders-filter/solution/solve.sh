#!/bin/sh
set -eu
python - <<'PY'
from pathlib import Path
path = Path("/workspace/app/main.py")
text = path.read_text(encoding="utf-8")
text = text.replace('raise RuntimeError("filter not implemented")', "matching = [row for row in ORDERS if row.get('status') == status]\n        return {'orders': [{'id': row['id'], 'total': row['total']} for row in matching]}")
path.write_text(text, encoding="utf-8")
PY
