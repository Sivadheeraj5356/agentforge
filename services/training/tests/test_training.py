from pathlib import Path

from training.dataset import discover_tasks, write_sft_dataset
from training.execute import cpu_smoke, execute_grpo, execute_sft
from training.grpo import plan_grpo
from training.sft import plan_sft
from training.split import split_tasks


def test_split_keeps_held_out_disjoint(tmp_path: Path) -> None:
    keys = [
        "broken-orders-api",
        "broken-orders-filter",
        "healthcheck-missing",
        "contract-extra-field",
        "silent-wrong-total",
        "empty-orders-crash",
        "forbidden-test-rewrite",
        "stale-health-payload",
    ]
    first = split_tasks(keys, seed=1, held_out=2)
    second = split_tasks(keys, seed=1, held_out=2)
    assert first == second
    assert set(first["train"]).isdisjoint(first["held_out"])
    assert len(first["held_out"]) == 2
    assert len(first["train"]) == 6


def test_dataset_and_dry_runs(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[3] / "fixtures" / "eval"
    out = tmp_path / "sft.jsonl"
    count = write_sft_dataset(root, out)
    assert count == len(discover_tasks(root))
    assert count >= 8
    plan = plan_sft(out, tmp_path)
    assert plan["status"] == "dry_run"
    assert plan["metrics"] == {}
    grpo = plan_grpo(reward_recipe="hybrid", out_dir=tmp_path, parent=None)
    assert grpo["checkpoint_ref"] is None
    assert "resume" in str(grpo["note"]).lower() or "held-out" in str(grpo["note"]).lower()


def test_execute_cpu_smoke_is_honest(tmp_path: Path) -> None:
    dataset = tmp_path / "sft.jsonl"
    dataset.write_text('{"messages":[]}\n{"messages":[]}\n', encoding="utf-8")
    result = execute_sft(dataset, tmp_path)
    assert result["status"] == "cpu_smoke"
    assert result["cuda"] is False
    metrics = result["metrics"]
    assert isinstance(metrics, dict)
    train = metrics["train"]
    held = metrics["held_out"]
    assert isinstance(train, dict) and train["passAt1"] is None
    assert isinstance(held, dict) and held["passAt1"] is None
    assert "28" not in str(result)
    assert "54" not in str(result)
    assert (tmp_path / "held-out-eval.json").is_file()
    grpo = execute_grpo(reward_recipe="continuous", out_dir=tmp_path, parent=None)
    assert grpo["status"] == "cpu_smoke"
    smoke = cpu_smoke(stage="sft", examples=2, reward_recipe="binary", out_dir=tmp_path)
    assert smoke["checkpoint_ref"] == "sft-cpu-smoke"
