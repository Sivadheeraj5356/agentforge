from pathlib import Path

from evaluator.import_tasks import discover_task_dirs, main


def test_discovers_committed_vortex_fixtures() -> None:
    root = Path(__file__).resolve().parents[3] / "fixtures" / "eval"
    names = [path.name for path in discover_task_dirs(root)]
    assert "broken-orders-api" in names
    assert "ledger-evolve" in names
    assert "spec-to-kit" in names
    assert len(names) == 10
    assert "_shared" not in names


def test_import_main_pins_tb2_when_env_set(tmp_path: Path, monkeypatch, capsys) -> None:
    task = tmp_path / "hello-world"
    task.mkdir()
    (task / "instruction.md").write_text("fix me\n", encoding="utf-8")
    (task / "task.toml").write_text("version = 1\n", encoding="utf-8")
    monkeypatch.setenv("TB_FIXTURES_DIR", str(tmp_path))
    assert main([]) == 0
    out = capsys.readouterr().out
    assert "benchmark=terminal-bench" in out
    assert "version=2.0.0" in out
    assert "hello-world" in out
