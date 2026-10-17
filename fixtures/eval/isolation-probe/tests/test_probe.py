import json
from pathlib import Path


def test_probe_results_exist() -> None:
    assert json.loads(Path("/workspace/probe_results.json").read_text())
