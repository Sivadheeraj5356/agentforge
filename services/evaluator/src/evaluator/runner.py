"""Evaluation loop: reset → run agent → grade → persist-ready outcome."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass

from evaluator.failure_taxonomy import classify_failure
from evaluator.passk import pass_at_k
from evaluator.rewards import round_reward
from evaluator.sandbox.protocol import TrialOutcome
from evaluator.sandbox.select import run_with_optional_task_dir, select_sandbox


@dataclass(frozen=True)
class RunRequest:
    task_key: str
    agent_kind: str
    recipe: str
    attempt_count: int
    sandbox_provider: str
    timeout_seconds: int
    fixtures_dir: str
    harbor_bin: str
    task_dir: str | None
    allow_fake: bool
    composition: str = "single"
    harbor_model: str | None = None
    openai_base_url: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    work_model_provider: str = "openai"
    eval_image: str | None = None
    pack_key: str | None = None
    environments_dir: str | None = None
    stages: list[dict[str, object]] | None = None
    scenario_instruction: str | None = None
    byo_cmd: str | None = None
    byo_http_url: str | None = None
    enable_harbor: bool = False


@dataclass
class AggregatedRun:
    trials: list[TrialOutcome]
    mean_reward: float
    median_reward: float
    pass_at_1: float
    pass_at_k: float
    k: int
    failure_categories: list[str]
    mean_latency_ms: float
    p95_latency_ms: float
    mean_tool_calls: float


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 0:
        return round_reward((ordered[mid - 1] + ordered[mid]) / 2)
    return round_reward(ordered[mid])


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(len(ordered) * percentile)))
    return ordered[index]


def run_evaluation(request: RunRequest) -> AggregatedRun:
    sandbox = select_sandbox(
        request.sandbox_provider,
        fixtures_dir=request.fixtures_dir,
        harbor_bin=request.harbor_bin,
        allow_fake=request.allow_fake,
        harbor_model=request.harbor_model,
        openai_base_url=request.openai_base_url,
        openai_api_key=request.openai_api_key,
        anthropic_api_key=request.anthropic_api_key,
        anthropic_model=request.anthropic_model,
        work_model_provider=request.work_model_provider,
        eval_image=request.eval_image,
        environments_dir=request.environments_dir,
        byo_cmd=request.byo_cmd,
        byo_http_url=request.byo_http_url,
        enable_harbor=request.enable_harbor,
    )
    trials: list[TrialOutcome] = []
    for _ in range(request.attempt_count):
        started = time.perf_counter()
        outcome = run_with_optional_task_dir(
            sandbox,
            task_key=request.task_key,
            agent_kind=request.agent_kind,
            recipe=request.recipe,
            timeout_seconds=request.timeout_seconds,
            task_dir=request.task_dir,
            composition=request.composition,
            pack_key=request.pack_key,
            environments_dir=request.environments_dir,
            stages=request.stages,
            scenario_instruction=request.scenario_instruction,
        )
        outcome.duration_ms = int((time.perf_counter() - started) * 1000)
        trials.append(outcome)

    rewards = [trial.reward for trial in trials]
    latencies = [float(trial.duration_ms) for trial in trials]
    tool_calls = [float(len(trial.steps)) for trial in trials]
    correct = sum(1 for reward in rewards if reward >= 1.0)
    k = request.attempt_count
    categories = [
        classify_failure(
            agent_kind=request.agent_kind,
            reward=trial.reward,
            metrics=trial.metrics,
            timed_out=trial.timed_out,
            grader_tampered=trial.grader_tampered,
            tool_calls=len(trial.steps),
        )
        for trial in trials
    ]
    return AggregatedRun(
        trials=trials,
        mean_reward=round_reward(sum(rewards) / len(rewards)),
        median_reward=_median(rewards),
        pass_at_1=pass_at_k(len(rewards), correct, 1),
        pass_at_k=pass_at_k(len(rewards), correct, k),
        k=k,
        failure_categories=categories,
        mean_latency_ms=sum(latencies) / len(latencies),
        p95_latency_ms=_percentile(latencies, 0.95),
        mean_tool_calls=sum(tool_calls) / len(tool_calls),
    )


def trajectory_payload(outcome: TrialOutcome) -> str:
    return json.dumps({"steps": [asdict(step) for step in outcome.steps]}, indent=2)
