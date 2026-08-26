"""Reward recipes. Verifier evidence in, learning signal out."""

from __future__ import annotations

from typing import Mapping

CONTINUOUS_WEIGHTS = {
    "critical_tests": 0.5,
    "regression_tests": 0.2,
    "api_contract": 0.1,
    "diff_quality": 0.1,
    "service_health": 0.1,
}

HYBRID_WEIGHTS = {
    "outcome": 0.6,
    "efficiency": 0.15,
    "safety": 0.1,
    "correctness": 0.15,
}


def round_reward(value: float) -> float:
    clamped = min(1.0, max(0.0, value))
    return round(clamped, 4)


def binary_reward(passed: bool) -> float:
    return 1.0 if passed else 0.0


def continuous_outcome_reward(metrics: Mapping[str, float]) -> float:
    total = 0.0
    for key, weight in CONTINUOUS_WEIGHTS.items():
        total += weight * float(metrics[key])
    return round_reward(total)


def hybrid_reward(metrics: Mapping[str, float]) -> float:
    total = 0.0
    for key, weight in HYBRID_WEIGHTS.items():
        total += weight * float(metrics[key])
    return round_reward(total)


DEFAULT_STAGED_STAGES = (
    {"id": "investigate", "weight": 0.2, "metric_key": "service_health"},
    {"id": "patch", "weight": 0.45, "metric_key": "critical_tests"},
    {"id": "contract", "weight": 0.15, "metric_key": "api_contract"},
    {"id": "safety", "weight": 0.2, "metric_key": "diff_quality"},
)


def staged_breakdown(
    metrics: Mapping[str, float],
    stages: list[dict[str, object]] | tuple[dict[str, object], ...] | None = None,
) -> tuple[float, dict[str, float]]:
    selected = list(stages) if stages else list(DEFAULT_STAGED_STAGES)
    total = 0.0
    extras: dict[str, float] = {}
    for stage in selected:
        stage_id = str(stage.get("id") or "stage")
        weight = float(stage.get("weight") or 0.0)
        metric_key = str(stage.get("metric_key") or stage.get("metricKey") or "")
        value = float(metrics.get(metric_key, 0.0))
        extras[f"stage_{stage_id.replace('-', '_')}"] = value
        total += weight * value
    return round_reward(total), extras


def apply_recipe(
    recipe: str,
    metrics: Mapping[str, float],
    stages: list[dict[str, object]] | tuple[dict[str, object], ...] | None = None,
) -> float:
    if recipe == "binary":
        return binary_reward(float(metrics.get("critical_tests", 0)) >= 1.0)
    if recipe == "continuous":
        return continuous_outcome_reward(metrics)
    if recipe == "hybrid":
        outcome = continuous_outcome_reward(metrics)
        return hybrid_reward(
            {
                "outcome": outcome,
                "efficiency": float(metrics.get("efficiency", 1.0)),
                "safety": float(metrics.get("safety", metrics.get("diff_quality", 1.0))),
                "correctness": float(metrics.get("correctness", metrics.get("api_contract", 1.0))),
            }
        )
    if recipe == "staged":
        reward, _extras = staged_breakdown(metrics, stages)
        return reward
    raise ValueError(f"unknown reward recipe: {recipe}")
