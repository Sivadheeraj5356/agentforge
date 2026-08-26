import os
import shutil
import subprocess
from pathlib import Path

import pytest

from evaluator.runner import RunRequest, run_evaluation
from evaluator.sandbox.fake import FakeSandbox
from evaluator.sandbox.harbor import (
    HarborArgumentError,
    build_harbor_argv,
    parse_harbor_job_dir,
    reject_forbidden_args,
)
from evaluator.sandbox.select import select_sandbox

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "eval"
_SKIP_ISOLATED = shutil.which("docker") is None or os.environ.get(
    "AGENTFORGE_SKIP_ISOLATED_SANDBOX", os.environ.get("VORTEX_SKIP_ISOLATED_SANDBOX")
) == "1"


def _harbor_cli_ready() -> bool:
    binary = shutil.which("harbor")
    if not binary:
        return False
    try:
        completed = subprocess.run(
            [binary, "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return completed.returncode == 0 or "usage" in (completed.stdout + completed.stderr).lower()


def test_oracle_solves_and_nop_fails() -> None:
    oracle = FakeSandbox().run_trial(
        task_key="broken-orders-api",
        agent_kind="oracle",
        recipe="binary",
        timeout_seconds=30,
    )
    nop = FakeSandbox().run_trial(
        task_key="broken-orders-api",
        agent_kind="nop",
        recipe="binary",
        timeout_seconds=30,
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.0
    assert oracle.steps[0].command == "solution/solve.sh"


def test_fake_staged_recipe() -> None:
    oracle = FakeSandbox().run_trial(
        task_key="broken-orders-api",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
    )
    nop = FakeSandbox().run_trial(
        task_key="broken-orders-api",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.2
    assert "stage_patch" in oracle.metrics


@pytest.mark.parametrize("task_key", ["delete-tests", "touch-grader", "fake-output"])
def test_adversarial_attempts_never_score_one(task_key: str) -> None:
    outcome = FakeSandbox().run_trial(
        task_key=task_key,
        agent_kind="agent",
        recipe="continuous",
        timeout_seconds=30,
    )
    assert outcome.reward < 1.0
    assert outcome.grader_tampered is True or outcome.metrics["critical_tests"] == 0.0


def test_harbor_argv_rejects_docker_socket(tmp_path: Path) -> None:
    argv = build_harbor_argv(
        harbor_bin="harbor",
        task_dir="fixtures/eval/broken-orders-api",
        agent_kind="oracle",
        jobs_dir=str(tmp_path),
    )
    assert "--timeout" not in argv
    assert "--privileged" not in argv
    assert "docker.sock" not in " ".join(argv)
    assert argv[argv.index("--agent") + 1] == "oracle"
    with pytest.raises(HarborArgumentError):
        reject_forbidden_args(["docker", "run", "-v", "/var/run/docker.sock:/var/run/docker.sock"])
    with pytest.raises(HarborArgumentError, match="HARBOR_MODEL"):
        build_harbor_argv(
            harbor_bin="harbor",
            task_dir="fixtures/eval/broken-orders-api",
            agent_kind="agent",
            jobs_dir=str(tmp_path),
        )
    agent_argv = build_harbor_argv(
        harbor_bin="harbor",
        task_dir="fixtures/eval/broken-orders-api",
        agent_kind="agent",
        jobs_dir=str(tmp_path),
        model="openai/gpt-4.1-mini",
        agent_env={"OPENAI_API_KEY": "sk-test"},
    )
    assert agent_argv[agent_argv.index("--agent") + 1] == "terminus-2"
    from evaluator.sandbox.harbor import redact_argv

    logged = " ".join(redact_argv(agent_argv))
    assert "sk-test" not in logged
    assert "OPENAI_API_KEY=***" in logged
    anthropic_argv = build_harbor_argv(
        harbor_bin="harbor",
        task_dir="fixtures/eval/broken-orders-api",
        agent_kind="agent",
        jobs_dir=str(tmp_path),
        model="anthropic/claude-sonnet-4-5",
        agent_env={"ANTHROPIC_API_KEY": "sk-ant-secret"},
    )
    logged_anthropic = " ".join(redact_argv(anthropic_argv))
    assert "sk-ant-secret" not in logged_anthropic
    assert "ANTHROPIC_API_KEY=***" in logged_anthropic
    multi_argv = build_harbor_argv(
        harbor_bin="harbor",
        task_dir="fixtures/eval/broken-orders-api",
        agent_kind="multi_agent",
        jobs_dir=str(tmp_path),
        model="openai/gpt-4.1-mini",
        agent_env={"VORTEX_COMPOSITION": "multi_agent", "OPENAI_API_KEY": "sk-test"},
    )
    assert multi_argv[multi_argv.index("--agent") + 1] == "terminus-2"
    assert "--model" in multi_argv
    assert any(token.startswith("VORTEX_COMPOSITION=") for token in multi_argv)
    multi_alias = build_harbor_argv(
        harbor_bin="harbor",
        task_dir="fixtures/eval/broken-orders-api",
        agent_kind="multi_agent",
        jobs_dir=str(tmp_path),
        model="openai/gpt-4.1-mini",
        agent_env={"AGENTFORGE_COMPOSITION": "multi_agent", "OPENAI_API_KEY": "sk-test"},
    )
    assert any(token.startswith("AGENTFORGE_COMPOSITION=") for token in multi_alias)


def test_harbor_parses_reward_json(tmp_path: Path) -> None:
    (tmp_path / "trial").mkdir()
    (tmp_path / "trial" / "reward.json").write_text(
        '{"reward": 0.5, "critical_tests": 0.0, "service_health": 1.0}',
        encoding="utf-8",
    )
    reward, metrics = parse_harbor_job_dir(tmp_path)
    assert reward == 0.5
    assert metrics["critical_tests"] == 0.0


def test_isolated_argv_rejects_docker_socket() -> None:
    from evaluator.sandbox.isolated import _reject_socket

    with pytest.raises(ValueError, match="docker.sock"):
        _reject_socket(["docker", "run", "-v", "/var/run/docker.sock:/var/run/docker.sock"])
    with pytest.raises(ValueError, match="writable hidden"):
        _reject_socket(["docker", "run", "-v", "ws:/workspace", "-v", "hid:/hidden"])


@pytest.mark.skipif(_SKIP_ISOLATED, reason="docker required")
def test_isolated_oracle_solves_and_nop_fails() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox

    sandbox = IsolatedSandbox(str(_FIXTURES))
    oracle = sandbox.run_trial(
        task_key="broken-orders-api",
        agent_kind="oracle",
        recipe="binary",
        timeout_seconds=60,
    )
    nop = sandbox.run_trial(
        task_key="broken-orders-api",
        agent_kind="nop",
        recipe="binary",
        timeout_seconds=60,
    )
    assert oracle.reward == 1.0, oracle.log[-1500:]
    assert nop.reward == 0.0, nop.log[-1500:]


@pytest.mark.skipif(_SKIP_ISOLATED, reason="docker required")
def test_isolated_orders_ops_staged_oracle_vs_nop() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox

    environments = Path(__file__).resolve().parents[3] / "environments"
    sandbox = IsolatedSandbox(str(_FIXTURES), environments_dir=str(environments))
    oracle = sandbox.run_trial(
        task_key="broken-orders-api",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=60,
        pack_key="orders-ops",
        environments_dir=str(environments),
    )
    nop = sandbox.run_trial(
        task_key="broken-orders-api",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=60,
        pack_key="orders-ops",
        environments_dir=str(environments),
    )
    assert oracle.reward == 1.0, oracle.log[-1500:]
    assert nop.reward < 1.0
    assert "stage_patch" in oracle.metrics


@pytest.mark.skipif(_SKIP_ISOLATED, reason="docker required")
def test_isolated_multi_agent_roles_then_hidden_grader() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox

    sandbox = IsolatedSandbox(str(_FIXTURES))
    outcome = sandbox.run_trial(
        task_key="broken-orders-api",
        agent_kind="oracle",
        recipe="binary",
        timeout_seconds=60,
        composition="multi_agent",
    )
    tools = [step.tool for step in outcome.steps]
    assert tools[:4] == ["planner", "coder", "tester", "reviewer"]
    assert tools[-1] == "verifier"
    assert outcome.reward == 1.0, outcome.log[-1500:]
    from evaluator.workenv.model_agent import MissingWorkModelKeyError

    with pytest.raises(MissingWorkModelKeyError):
        sandbox.run_trial(
            task_key="broken-orders-api",
            agent_kind="multi_agent",
            recipe="binary",
            timeout_seconds=60,
            composition="multi_agent",
        )


@pytest.mark.skipif(_SKIP_ISOLATED, reason="docker required")
def test_isolated_ledger_evolve_oracle_vs_nop() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox

    environments = Path(__file__).resolve().parents[3] / "environments"
    sandbox = IsolatedSandbox(str(_FIXTURES), environments_dir=str(environments))
    oracle = sandbox.run_trial(
        task_key="ledger-evolve",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=60,
        pack_key="horizon-swe",
        environments_dir=str(environments),
    )
    nop = sandbox.run_trial(
        task_key="ledger-evolve",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=60,
        pack_key="horizon-swe",
        environments_dir=str(environments),
    )
    assert oracle.reward == 1.0, oracle.log[-1500:]
    assert nop.reward < 1.0
    assert nop.metrics["idempotent_post"] == 0.0


@pytest.mark.skipif(_SKIP_ISOLATED, reason="docker required")
def test_isolated_spec_to_kit_oracle_vs_nop() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox

    sandbox = IsolatedSandbox(str(_FIXTURES))
    oracle = sandbox.run_trial(
        task_key="spec-to-kit",
        agent_kind="oracle",
        recipe="binary",
        timeout_seconds=60,
    )
    nop = sandbox.run_trial(
        task_key="spec-to-kit",
        agent_kind="nop",
        recipe="binary",
        timeout_seconds=60,
    )
    assert oracle.reward == 1.0, oracle.log[-1500:]
    assert nop.reward < 1.0
    assert nop.metrics["spec_implemented"] == 0.0
    assert nop.metrics["forbidden_import"] == 1.0


def test_fake_sandbox_forbidden_for_untrusted() -> None:
    with pytest.raises(RuntimeError, match="not allowed"):
        select_sandbox("fake", fixtures_dir="fixtures/eval", harbor_bin="harbor", allow_fake=False)


def test_pass_at_k_on_three_oracle_attempts() -> None:
    aggregated = run_evaluation(
        RunRequest(
            task_key="broken-orders-api",
            agent_kind="oracle",
            recipe="binary",
            attempt_count=3,
            sandbox_provider="fake",
            timeout_seconds=10,
            fixtures_dir="fixtures/eval",
            harbor_bin="harbor",
            task_dir=None,
            allow_fake=True,
        )
    )
    assert aggregated.pass_at_1 == 1.0
    assert aggregated.pass_at_k == 1.0
    assert aggregated.k == 3
    assert aggregated.mean_reward == 1.0
    assert aggregated.mean_latency_ms >= 0
    assert aggregated.mean_tool_calls >= 1


def test_harbor_absent_fails_clearly_never_fakes_a_pass() -> None:
    from evaluator.sandbox.harbor import HarborSandbox

    if shutil.which("harbor"):
        pytest.skip("Harbor binary is on PATH")
    sandbox = HarborSandbox("harbor")
    with pytest.raises(RuntimeError, match="harbor CLI is not installed"):
        sandbox.run_trial(
            task_key="broken-orders-api",
            agent_kind="oracle",
            recipe="binary",
            timeout_seconds=30,
            task_dir=str(_FIXTURES / "broken-orders-api"),
        )


@pytest.mark.skipif(not _harbor_cli_ready(), reason="Harbor CLI not installed or unresponsive")
def test_harbor_oracle_and_nop_smoke() -> None:
    oracle = run_evaluation(
        RunRequest(
            task_key="broken-orders-api",
            agent_kind="oracle",
            recipe="binary",
            attempt_count=1,
            sandbox_provider="harbor",
            timeout_seconds=180,
            fixtures_dir=str(_FIXTURES),
            harbor_bin="harbor",
            task_dir=str(_FIXTURES / "broken-orders-api"),
            allow_fake=False,
        )
    )
    nop = run_evaluation(
        RunRequest(
            task_key="broken-orders-api",
            agent_kind="nop",
            recipe="binary",
            attempt_count=1,
            sandbox_provider="harbor",
            timeout_seconds=180,
            fixtures_dir=str(_FIXTURES),
            harbor_bin="harbor",
            task_dir=str(_FIXTURES / "broken-orders-api"),
            allow_fake=False,
        )
    )
    assert oracle.pass_at_1 == 1.0
    assert nop.pass_at_1 == 0.0
    assert "54" not in str(oracle.mean_reward)
    assert "28" not in str(nop.mean_reward)


def test_select_sandbox_harbor_retired() -> None:
    with pytest.raises(RuntimeError, match="retired"):
        select_sandbox(
            "harbor",
            fixtures_dir=str(_FIXTURES),
            harbor_bin="harbor",
            allow_fake=False,
        )

