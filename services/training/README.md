# Training (execution-adjacent plane)

Converts expert trajectories into chat JSON and records SFT / GRPO experiments.
**Not imported by `apps/web`. No training happens in Next.js.**

Torch / TRL / PEFT are optional and **not** installed by default. This package
writes datasets, split files, experiment metadata, and `--execute` CPU smokes.
It does not invent pass-rate numbers.

```bash
cd services/training
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
python -m training --help
python -m pytest
```

Dry-run (no GPU):

```bash
python -m training dataset --root ..\..\fixtures\eval --out .data\training
python -m training split --root ..\..\fixtures\eval --seed 1 --held-out 2
python -m training sft --dataset .data\training\sft.jsonl --dry-run
python -m training grpo --dry-run --reward-recipe continuous
```

Execute (GPU gate):

```bash
python -m training sft --dataset .data\training\sft.jsonl --execute
python -m training grpo --execute --reward-recipe continuous
```

Without CUDA, `--execute` writes a **CPU smoke** (`status: cpu_smoke`, `passAt1: null`
for both train and held-out). That is not a resume result. After a real GPU job,
enqueue held-out eval through `services/evaluator` (not Next.js) and copy those
rows into `training_experiments.metrics`. Empty metrics stay unpublished.

Optional extras (`pip install torch trl peft transformers`) stay in this service
only. GRPO’s env is Harbor via the evaluator (ADR-022).

Resume claims that quote success rates are valid only after a real run writes
`training_experiments.metrics` **and** held-out evaluator rows exist.
