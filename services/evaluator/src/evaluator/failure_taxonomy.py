"""Deterministic failure taxonomy. No LLM."""

from __future__ import annotations

from typing import Mapping

CATEGORIES = (
    "planning",
    "tool_selection",
    "code_understanding",
    "environment_navigation",
    "verification",
    "recovery",
    "hallucinated_assumption",
    "timeout",
    "destructive_action",
    "none",
)


def classify_failure(
    *,
    agent_kind: str,
    reward: float,
    metrics: Mapping[str, float],
    timed_out: bool,
    grader_tampered: bool,
    tool_calls: int,
) -> str:
    if reward >= 1.0:
        return "none"
    if grader_tampered or float(metrics.get("diff_quality", 1.0)) <= 0.0:
        return "destructive_action"
    if timed_out:
        return "timeout"
    if agent_kind == "nop":
        return "verification"
    if tool_calls == 0 and agent_kind == "agent":
        return "planning"
    if float(metrics.get("critical_tests", 0.0)) <= 0.0:
        return "code_understanding"
    if float(metrics.get("api_contract", 1.0)) < 1.0:
        return "verification"
    return "recovery"
