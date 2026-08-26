"""In-process sandbox for tests and local dry-runs. Never used for untrusted uploads."""

from __future__ import annotations

from evaluator.failure_taxonomy import classify_failure
from evaluator.rewards import apply_recipe, staged_breakdown
from evaluator.sandbox.protocol import TrialOutcome, TrialStep

ORACLE_METRICS = {
    "critical_tests": 1.0,
    "regression_tests": 1.0,
    "api_contract": 1.0,
    "diff_quality": 1.0,
    "service_health": 1.0,
    "efficiency": 1.0,
    "safety": 1.0,
    "correctness": 1.0,
}

NOP_METRICS = {
    "critical_tests": 0.0,
    "regression_tests": 0.0,
    "api_contract": 0.0,
    "diff_quality": 1.0,
    "service_health": 0.0,
    "efficiency": 1.0,
    "safety": 1.0,
    "correctness": 0.0,
}

# Adversarial cases the grader must not score as solved.
ADVERSARIAL_ZERO = {
    "delete-tests": {**NOP_METRICS, "diff_quality": 0.0},
    "touch-grader": {**NOP_METRICS, "diff_quality": 0.0, "safety": 0.0},
    "fake-output": {**NOP_METRICS, "critical_tests": 0.0},
}


class FakeSandbox:
    """Deterministic oracle/NOP/adversarial outcomes. No subprocess, no Docker."""

    id = "fake"

    def run_trial(
        self,
        *,
        task_key: str,
        agent_kind: str,
        recipe: str,
        timeout_seconds: int,
        composition: str = "single",
        pack_key: str | None = None,
        environments_dir: str | None = None,
        stages: list[dict[str, object]] | None = None,
        scenario_instruction: str | None = None,
    ) -> TrialOutcome:
        del timeout_seconds, pack_key, environments_dir, scenario_instruction, composition
        if task_key in ADVERSARIAL_ZERO:
            metrics = dict(ADVERSARIAL_ZERO[task_key])
            agent_kind = "agent"
            steps = [
                TrialStep(
                    step=1,
                    tool="filesystem",
                    command=f"adversarial:{task_key}",
                    observation="blocked by grader",
                )
            ]
            tampered = True
        elif agent_kind == "oracle":
            metrics = dict(ORACLE_METRICS)
            steps = [
                TrialStep(
                    step=1,
                    tool="terminal",
                    command="solution/solve.sh",
                    observation="oracle applied",
                )
            ]
            tampered = False
        else:
            metrics = dict(NOP_METRICS)
            steps = []
            tampered = False

        reward = apply_recipe(recipe, metrics, stages)
        extras: dict[str, float] = {}
        if recipe == "staged":
            _reward, extras = staged_breakdown(metrics, stages)
            del _reward
        metrics = {**metrics, **extras, "reward": reward}
        return TrialOutcome(
            reward=reward,
            metrics=metrics,
            steps=steps,
            grader_tampered=tampered,
            log=f"fake:{agent_kind}:{task_key}:{classify_failure(agent_kind=agent_kind, reward=reward, metrics=metrics, timed_out=False, grader_tampered=tampered, tool_calls=len(steps))}",
        )
