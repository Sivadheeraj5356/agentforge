"""Sandbox protocol. Agent and grader sessions are distinct."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class TrialStep:
    step: int
    tool: str
    command: str
    observation: str
    state_hash: str | None = None


@dataclass
class TrialOutcome:
    reward: float
    metrics: dict[str, float]
    steps: list[TrialStep] = field(default_factory=list)
    timed_out: bool = False
    grader_tampered: bool = False
    log: str = ""
    duration_ms: int = 0


class Sandbox(Protocol):
    id: str

    def run_trial(
        self,
        *,
        task_key: str,
        agent_kind: str,
        recipe: str,
        timeout_seconds: int,
    ) -> TrialOutcome: ...
