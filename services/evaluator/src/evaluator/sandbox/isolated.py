"""Two-role Docker isolation without mounting the host Docker socket.

Agent container: task workspace only.
Grader container: hidden tests + reward.py, no agent-writable /hidden.
Python deps live in a prebuilt image when available, else a third volume
the agent never sees.
"""

from __future__ import annotations

import json
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from evaluator.agents import MULTI_AGENT_ROLES
from evaluator.config import FORBIDDEN_SANDBOX_ARGS
from evaluator.env import env_first
from evaluator.rewards import apply_recipe, staged_breakdown
from evaluator.sandbox.isolated_tools import IsolatedWorkspaceHost
from evaluator.sandbox.protocol import TrialOutcome, TrialStep
from evaluator.workenv.model_agent import (
    MissingByoCommandError,
    MissingWorkModelKeyError,
    WorkModelConfig,
    require_work_model_key,
    run_tool_loop,
)
from evaluator.workenv.pack import PackError, load_pack

FALLBACK_IMAGE = "python:3.12-slim"
DEPS_INSTALL_TIMEOUT = 180


def resolve_eval_image(preferred: str | None = None) -> tuple[str, bool]:
    image = preferred or env_first(
        "AGENTFORGE_EVAL_IMAGE",
        "VORTEX_EVAL_IMAGE",
        default="agentforge-eval-python:3.12",
    ) or "agentforge-eval-python:3.12"
    if _image_exists(image):
        return image, True
    return FALLBACK_IMAGE, False


def _image_exists(image: str) -> bool:
    if shutil.which("docker") is None:
        return False
    completed = subprocess.run(
        ["docker", "image", "inspect", image],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
    )
    return completed.returncode == 0


class IsolatedSandbox:
    id = "isolated"

    def __init__(
        self,
        fixtures_dir: str,
        eval_image: str | None = None,
        environments_dir: str | None = None,
        *,
        work_model: WorkModelConfig | None = None,
        byo_cmd: str | None = None,
        http_post: Any | None = None,
    ) -> None:
        self.fixtures_dir = Path(fixtures_dir)
        self.eval_image = eval_image
        self.environments_dir = Path(environments_dir) if environments_dir else None
        self.work_model = work_model
        self.byo_cmd = byo_cmd
        self.http_post = http_post

    def available(self) -> bool:
        return shutil.which("docker") is not None

    def _task_dir(self, task_key: str) -> Path:
        candidate = self.fixtures_dir / task_key
        if not candidate.is_dir():
            raise FileNotFoundError(f"unknown fixture: {task_key}")
        return candidate.resolve()

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
        if agent_kind in {"agent", "multi_agent"}:
            if self.work_model is None:
                raise MissingWorkModelKeyError(
                    "Isolated reference agents need OPENAI_API_KEY or ANTHROPIC_API_KEY "
                    "on the evaluator worker."
                )
            require_work_model_key(self.work_model)
        if agent_kind == "byo" and not self.byo_cmd:
            raise MissingByoCommandError(
                "AGENTFORGE_BYO_CMD is required on the evaluator for Isolated BYO agents."
            )
        if not self.available():
            raise RuntimeError("docker is not available")
        image, preloaded = resolve_eval_image(self.eval_image)
        task_dir = self._task_dir(task_key)
        env_root = Path(environments_dir) if environments_dir else self.environments_dir
        with tempfile.TemporaryDirectory(prefix="agentforge-eval-") as tmp:
            workspace = Path(tmp) / "workspace"
            hidden = Path(tmp) / "hidden"
            deps = Path(tmp) / "deps"
            context = Path(tmp) / "context"
            workspace.mkdir()
            hidden.mkdir()
            deps.mkdir()
            env_src = task_dir / "environment"
            if env_src.exists():
                shutil.copytree(env_src, workspace, dirs_exist_ok=True)
            context_src = _context_source(env_root, pack_key)
            if context_src is not None:
                shutil.copytree(context_src, context)
            tests_src = task_dir / "tests"
            if not tests_src.exists():
                tests_src = self.fixtures_dir / "_shared" / "tests"
            if tests_src.exists():
                shutil.copytree(tests_src, hidden / "tests", dirs_exist_ok=True)
            if agent_kind == "oracle":
                solve = task_dir / "solution" / "solve.sh"
                if solve.exists():
                    _copy_script(solve, workspace / "solve.sh")
                fix = task_dir / "solution" / "fix.py"
                if fix.exists():
                    shutil.copy(fix, workspace / "fix.py")

            install = None if preloaded else _install_deps(workspace, deps, image)
            pythonpath = "/workspace" if preloaded else "/workspace:/deps"
            steps: list[TrialStep] = []
            agent_outputs: list[str] = []
            if scenario_instruction:
                agent_outputs.append(scenario_instruction[:400])

            extra_mounts: list[str] = []
            if context.is_dir():
                extra_mounts.extend(["-v", f"{_docker_bind(context)}:/workspace/context:ro"])
            if agent_kind == "byo":
                extra_mounts.extend(_byo_example_mounts())

            if composition == "multi_agent" and agent_kind == "oracle":
                for index, role in enumerate(MULTI_AGENT_ROLES, start=1):
                    command = ["true"]
                    if role == "coder":
                        command = _oracle_command(workspace)
                    observation = _run_agent(
                        workspace, image, command, timeout_seconds, extra_mounts
                    )
                    agent_outputs.append(observation)
                    steps.append(TrialStep(index, role, " ".join(command), observation[-400:]))
                verifier_index = len(MULTI_AGENT_ROLES) + 1
            elif agent_kind in {"agent", "multi_agent"}:
                if self.work_model is None:
                    raise MissingWorkModelKeyError(
                        "Isolated reference agents need OPENAI_API_KEY or ANTHROPIC_API_KEY "
                        "on the evaluator worker."
                    )
                instruction = _isolated_instruction(task_dir, scenario_instruction)
                host = IsolatedWorkspaceHost(
                    workspace,
                    image=image,
                    extra_mounts=extra_mounts,
                    timeout_seconds=timeout_seconds,
                )
                model_steps = run_tool_loop(
                    host,
                    instruction=instruction,
                    config=self.work_model,
                    http_post=self.http_post,
                    role="agent",
                )
                offset = 1
                for step in model_steps:
                    steps.append(
                        TrialStep(offset, step.tool, step.command, step.observation[:4000])
                    )
                    agent_outputs.append(step.observation)
                    offset += 1
                verifier_index = offset
            elif agent_kind == "byo":
                if not self.byo_cmd:
                    raise MissingByoCommandError(
                        "AGENTFORGE_BYO_CMD is required on the evaluator for Isolated BYO agents."
                    )
                command = shlex.split(self.byo_cmd)
                observation = _run_agent(
                    workspace, image, command, timeout_seconds, extra_mounts
                )
                agent_outputs.append(observation)
                steps.append(TrialStep(1, "byo", " ".join(command), observation[-4000:]))
                verifier_index = 2
            else:
                command = _oracle_command(workspace) if agent_kind == "oracle" else ["true"]
                observation = _run_agent(
                    workspace, image, command, timeout_seconds, extra_mounts
                )
                agent_outputs.append(observation)
                steps.append(TrialStep(1, "terminal", " ".join(command), observation[-400:]))
                verifier_index = 2

            grader_argv = [
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                "-v",
                f"{_docker_bind(workspace)}:/workspace:ro",
                "-v",
                f"{_docker_bind(hidden)}:/hidden:ro",
            ]
            if not preloaded:
                grader_argv.extend(["-v", f"{_docker_bind(deps)}:/deps:ro"])
            grader_argv.extend(
                [
                    "-e",
                    f"PYTHONPATH={pythonpath}",
                    "-e",
                    "REWARD_PATH=/tmp/reward.json",
                    image,
                    "python",
                    "/hidden/tests/reward.py",
                ]
            )
            _reject_socket(grader_argv)
            grader = _run_docker(grader_argv, timeout_seconds)
            steps.append(
                TrialStep(
                    verifier_index,
                    "verifier",
                    "reward.py",
                    _stream(grader.stdout)[-500:] or _stream(grader.stderr)[-500:],
                )
            )

        metrics = _parse_metrics(_stream(grader.stdout))
        if recipe == "staged":
            reward, extras = staged_breakdown(metrics, stages)
            metrics.update(extras)
        else:
            reward = apply_recipe(recipe, metrics)
        metrics["reward"] = reward
        install_log = "" if install is None else _stream(install.stdout) + _stream(install.stderr)
        return TrialOutcome(
            reward=reward,
            metrics=metrics,
            steps=steps,
            log=(install_log + "".join(agent_outputs) + _stream(grader.stdout) + _stream(grader.stderr))[
                -8000:
            ],
            grader_tampered=metrics.get("diff_quality", 1.0) <= 0.0,
        )


def _byo_example_mounts() -> list[str]:
    example = Path(__file__).resolve().parents[5] / "examples" / "byo-isolated"
    if not example.is_dir():
        return []
    return ["-v", f"{_docker_bind(example)}:/opt/byo:ro"]


def _context_source(environments_dir: Path | None, pack_key: str | None) -> Path | None:
    if environments_dir is None:
        return None
    mount = "families/orders-ops/context"
    if pack_key:
        try:
            pack = load_pack(environments_dir, pack_key)
            if isinstance(pack.get("contextMount"), str):
                mount = str(pack["contextMount"])
        except PackError:
            pass
    candidate = (environments_dir / mount).resolve()
    try:
        candidate.relative_to(environments_dir.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_dir() else None


def _isolated_instruction(task_dir: Path, overlay: str | None) -> str:
    parts: list[str] = []
    if overlay:
        parts.append(overlay)
    instruction = task_dir / "instruction.md"
    if instruction.is_file():
        parts.append(instruction.read_text(encoding="utf-8"))
    parts.append(
        "Use list_dir, read_file, write_file, and run_command on /workspace. "
        "Do not rewrite hidden tests or touch /hidden."
    )
    return "\n\n".join(parts)


def _oracle_command(workspace: Path) -> list[str]:
    if (workspace / "fix.py").exists():
        return ["python", "/workspace/fix.py"]
    if (workspace / "solve.sh").exists():
        return ["sh", "/workspace/solve.sh"]
    return ["true"]


def _run_agent(
    workspace: Path,
    image: str,
    command: list[str],
    timeout_seconds: int,
    extra_mounts: list[str] | None = None,
) -> str:
    argv = [
        "docker",
        "run",
        "--rm",
        "--network",
        "none",
        "-v",
        f"{_docker_bind(workspace)}:/workspace",
        *(extra_mounts or []),
        image,
        *command,
    ]
    _reject_socket(argv)
    completed = _run_docker(argv, timeout_seconds)
    return _stream(completed.stdout) or _stream(completed.stderr)


def _copy_script(src: Path, dest: Path) -> None:
    dest.write_bytes(src.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _docker_bind(path: Path) -> str:
    return path.resolve().as_posix()


def _install_deps(
    workspace: Path, deps: Path, image: str
) -> subprocess.CompletedProcess[str] | None:
    requirements = workspace / "requirements.txt"
    if not requirements.is_file():
        return None
    argv = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{_docker_bind(workspace)}:/workspace:ro",
        "-v",
        f"{_docker_bind(deps)}:/deps",
        "-v",
        "vortex-eval-pip-cache:/root/.cache/pip",
        image,
        "pip",
        "install",
        "--disable-pip-version-check",
        "-r",
        "/workspace/requirements.txt",
        "-t",
        "/deps",
    ]
    _reject_socket(argv)
    return _run_docker(argv, DEPS_INSTALL_TIMEOUT)


def _stream(value: str | None) -> str:
    return value or ""


def _run_docker(argv: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_seconds,
    )


def _reject_socket(argv: list[str]) -> None:
    joined = " ".join(argv)
    for token in FORBIDDEN_SANDBOX_ARGS:
        if token in joined:
            raise ValueError(f"refusing sandbox argument: {token}")
    volume_args = [argv[index + 1] for index, item in enumerate(argv) if item == "-v" and index + 1 < len(argv)]
    for mount in volume_args:
        if "/var/run/docker.sock" in mount:
            raise ValueError("refusing sandbox argument: docker.sock")
    if "/workspace" in joined and ":/hidden" in joined and ":/hidden:ro" not in joined:
        raise ValueError("refusing writable hidden mount")


def _parse_metrics(stdout: str) -> dict[str, float]:
    for line in reversed(stdout.strip().splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            payload = json.loads(line)
            return {key: float(value) for key, value in payload.items()}
    return {
        "critical_tests": 0.0,
        "regression_tests": 0.0,
        "api_contract": 0.0,
        "diff_quality": 1.0,
        "service_health": 0.0,
    }
