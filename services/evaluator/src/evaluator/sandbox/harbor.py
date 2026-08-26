"""Harbor CLI sandbox. Never mounts the host Docker socket or uses --privileged."""

from __future__ import annotations

import json
import shutil
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path

from evaluator.agents import multi_agent_system_prompt
from evaluator.config import FORBIDDEN_SANDBOX_ARGS
from evaluator.rewards import apply_recipe
from evaluator.sandbox.protocol import TrialOutcome, TrialStep

HARBOR_AGENT_FLAGS = {
    "oracle": "oracle",
    "nop": "nop",
    "agent": "terminus-2",
    "multi_agent": "terminus-2",
}

SECRET_ENV_KEYS = {"OPENAI_API_KEY", "API_KEY", "ANTHROPIC_API_KEY"}


class HarborArgumentError(ValueError):
    pass


def build_harbor_argv(
    *,
    harbor_bin: str,
    task_dir: str,
    agent_kind: str,
    jobs_dir: str,
    model: str | None = None,
    agent_env: Mapping[str, str] | None = None,
) -> list[str]:
    agent = HARBOR_AGENT_FLAGS.get(agent_kind)
    if agent is None:
        raise HarborArgumentError(f"unsupported agent kind: {agent_kind}")
    argv = [
        harbor_bin,
        "run",
        "--path",
        task_dir,
        "--agent",
        agent,
        "--jobs-dir",
        jobs_dir,
        "--n-concurrent",
        "1",
    ]
    if agent_kind in {"agent", "multi_agent"}:
        if not model:
            raise HarborArgumentError("HARBOR_MODEL is required for Terminus-2")
        argv.extend(["--model", model])
        for key, value in (agent_env or {}).items():
            if not key or not value:
                continue
            argv.extend(["--ae", f"{key}={value}"])
    reject_forbidden_args(argv)
    return argv


def redact_argv(argv: Sequence[str]) -> list[str]:
    redacted: list[str] = []
    hide_next = False
    for token in argv:
        if hide_next:
            key, sep, _value = token.partition("=")
            redacted.append(f"{key}{sep}***" if sep else "***")
            hide_next = False
            continue
        if token in {"--ae", "--agent-env"}:
            redacted.append(token)
            hide_next = True
            continue
        redacted.append(token)
    return redacted


def reject_forbidden_args(argv: Sequence[str]) -> None:
    joined = " ".join(argv)
    for token in FORBIDDEN_SANDBOX_ARGS:
        if token in joined:
            raise HarborArgumentError(f"refusing sandbox argument: {token}")


def parse_harbor_job_dir(jobs_dir: Path) -> tuple[float | None, dict[str, float]]:
    """Read Harbor verifier output. Prefer reward.json, then reward.txt."""
    json_files = sorted(jobs_dir.rglob("reward.json"))
    for path in json_files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        metrics: dict[str, float] = {}
        for key, value in payload.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                metrics[str(key)] = float(value)
        reward = metrics.get("reward")
        return reward, metrics

    txt_files = sorted(jobs_dir.rglob("reward.txt"))
    for path in txt_files:
        try:
            reward = float(path.read_text(encoding="utf-8").strip().split()[0])
        except (OSError, ValueError, IndexError):
            continue
        return reward, {"reward": reward}

    return None, {}


def _metrics_from_pass(passed: bool) -> dict[str, float]:
    score = 1.0 if passed else 0.0
    return {
        "critical_tests": score,
        "regression_tests": score,
        "api_contract": score,
        "diff_quality": 1.0,
        "service_health": score,
        "efficiency": 1.0,
        "safety": 1.0,
        "correctness": score,
    }


class HarborSandbox:
    id = "harbor"

    def __init__(
        self,
        harbor_bin: str = "harbor",
        *,
        model: str | None = None,
        openai_base_url: str | None = None,
        openai_api_key: str | None = None,
        anthropic_api_key: str | None = None,
    ) -> None:
        self.harbor_bin = harbor_bin
        self.model = model
        self.openai_base_url = openai_base_url
        self.openai_api_key = openai_api_key
        self.anthropic_api_key = anthropic_api_key

    def available(self) -> bool:
        return shutil.which(self.harbor_bin) is not None

    def run_trial(
        self,
        *,
        task_key: str,
        agent_kind: str,
        recipe: str,
        timeout_seconds: int,
        task_dir: str,
        composition: str = "single",
    ) -> TrialOutcome:
        del task_key
        kind = "multi_agent" if composition == "multi_agent" else agent_kind
        if not self.available():
            raise RuntimeError("harbor CLI is not installed")
        import subprocess

        agent_env: dict[str, str] = {}
        if self.openai_api_key:
            agent_env["OPENAI_API_KEY"] = self.openai_api_key
        if self.openai_base_url:
            agent_env["OPENAI_BASE_URL"] = self.openai_base_url
        if self.anthropic_api_key:
            agent_env["ANTHROPIC_API_KEY"] = self.anthropic_api_key
        if kind == "multi_agent":
            agent_env["AGENTFORGE_COMPOSITION"] = "multi_agent"
            agent_env["AGENTFORGE_SYSTEM_PROMPT"] = multi_agent_system_prompt()
            agent_env["VORTEX_COMPOSITION"] = "multi_agent"
            agent_env["VORTEX_SYSTEM_PROMPT"] = multi_agent_system_prompt()

        with tempfile.TemporaryDirectory(prefix="agentforge-harbor-") as jobs:
            argv = build_harbor_argv(
                harbor_bin=self.harbor_bin,
                task_dir=task_dir,
                agent_kind=kind,
                jobs_dir=jobs,
                model=self.model,
                agent_env=agent_env,
            )
            logged = " ".join(redact_argv(argv[1:6]))
            try:
                completed = subprocess.run(
                    argv,
                    check=False,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout_seconds + 5,
                )
            except subprocess.TimeoutExpired as exc:
                stdout = exc.stdout if isinstance(exc.stdout, str) else ""
                stderr = exc.stderr if isinstance(exc.stderr, str) else ""
                metrics = _metrics_from_pass(False)
                reward = apply_recipe(recipe, metrics)
                metrics["reward"] = reward
                return TrialOutcome(
                    reward=reward,
                    metrics=metrics,
                    steps=[
                        TrialStep(step=1, tool="harbor", command=logged, observation="timeout")
                    ],
                    log=(stdout + stderr)[-8000:],
                    timed_out=True,
                )

            log = (completed.stdout or "") + (completed.stderr or "")
            parsed_reward, parsed_metrics = parse_harbor_job_dir(Path(jobs))
            if parsed_metrics:
                metrics = {**_metrics_from_pass(False), **parsed_metrics}
                passed = (parsed_reward if parsed_reward is not None else 0.0) >= 1.0
                if "critical_tests" not in parsed_metrics:
                    metrics["critical_tests"] = 1.0 if passed else 0.0
            else:
                passed = completed.returncode == 0
                metrics = _metrics_from_pass(passed)
            reward = apply_recipe(recipe, metrics)
            metrics["reward"] = reward
            return TrialOutcome(
                reward=reward,
                metrics=metrics,
                steps=[
                    TrialStep(
                        step=1,
                        tool="harbor",
                        command=logged,
                        observation=f"exit {completed.returncode}",
                    )
                ],
                log=log[-8000:],
                timed_out=False,
            )
