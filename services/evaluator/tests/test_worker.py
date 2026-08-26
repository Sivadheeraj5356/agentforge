import json
from pathlib import Path

import pytest
from evaluator.artifacts import write_json_artifact
from evaluator.config import EvaluatorConfig
from evaluator.worker import process_job


class MemoryStore:
    def __init__(self) -> None:
        self.trials: list[dict] = []
        self.results: list[dict] = []
        self.artifacts: list[dict] = []
        self.job_status = "claimed"
        self.run_status = "queued"
        self.rollouts: list[dict] = []

    def mark_job(self, job_id: str, status: str, last_error: str | None = None) -> None:
        del job_id, last_error
        self.job_status = status

    def mark_run(self, run_id: str, status: str, started: bool, completed: bool) -> None:
        del run_id, started, completed
        self.run_status = status

    def get_run(self, run_id: str) -> dict:
        del run_id
        return {
            "id": "run-1",
            "agent_id": "agent-oracle",
            "task_version_id": "tv-1",
            "submission_id": "sub-1",
            "evaluator_configuration": {
                "schemaVersion": 1,
                "agentKind": "oracle",
                "attemptCount": 1,
                "rewardRecipe": "binary",
                "sandboxProvider": "fake",
            },
        }

    def get_agent(self, agent_id: str | None) -> dict:
        del agent_id
        return {"name": "oracle", "provider": "agentforge"}

    def get_task_key(self, task_version_id: str) -> str:
        del task_version_id
        return "broken-orders-api"

    def get_submission_kind(self, submission_id: str) -> str:
        del submission_id
        return "internal_package"

    def get_eval_scenario(self, organization_id: str, key: str) -> dict | None:
        del organization_id, key
        return None

    def insert_artifact(self, row: dict) -> dict:
        created = {**row, "id": f"art-{len(self.artifacts)+1}"}
        self.artifacts.append(created)
        return created

    def insert_trial(self, row: dict) -> dict:
        self.trials.append(row)
        return row

    def heartbeat_job(self, job_id: str, worker_id: str) -> None:
        del job_id, worker_id

    def insert_result(self, row: dict) -> None:
        self.results.append(row)

    def pin_run(self, run_id: str, git_sha: str | None, config_hash: str | None) -> None:
        del run_id
        self.git_sha = git_sha
        self.config_hash = config_hash

    def notify_run_terminal(self, run_id: str) -> None:
        self.terminal = run_id

    def pending_webhook_deliveries(self) -> list[dict]:
        return []

    def mark_webhook_delivery(self, delivery_id: str, status: str, last_error: str | None = None) -> None:
        del delivery_id, status, last_error

    def insert_rollout(self, row: dict) -> None:
        self.rollouts.append(row)


def test_worker_writes_oracle_trial(tmp_path: Path) -> None:
    store = MemoryStore()
    config = EvaluatorConfig(
        supabase_url="http://127.0.0.1:15421",
        service_role_key="test",
        worker_id="test-worker",
        sandbox_provider="fake",
        harbor_bin="harbor",
        harbor_model=None,
        openai_base_url=None,
        openai_api_key=None,
        anthropic_api_key=None,
        anthropic_model=None,
        work_model_provider="openai",
        fixtures_dir="fixtures/eval",
        tb_fixtures_dir=None,
        artifact_dir=str(tmp_path),
        timeout_seconds=30,
        allow_fake=True,
        eval_image="python:3.12-slim",
        lease_seconds=900,
        git_sha=None,
        environments_dir="environments",
        byo_cmd=None,
        byo_http_url=None,
        enable_harbor=False,
    )
    process_job(
        store,  # type: ignore[arg-type]
        config,
        {
            "id": "job-1",
            "evaluation_run_id": "run-1",
            "organization_id": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert store.job_status == "succeeded"
    assert store.run_status == "succeeded"
    assert store.trials[0]["reward"] == 1.0
    assert store.trials[0]["failure_category"] == "none"
    assert store.results[0]["payload"]["passAt1"] == 1.0
    assert store.results[0]["payload"]["costUsd"] is None
    assert store.trials[0]["cost_usd"] is None
    assert store.trials[0]["model_provider"] is None
    assert "meanLatencyMs" in store.results[0]["payload"]
    assert store.artifacts[0]["kind"] == "json"
    saved = tmp_path.joinpath(store.artifacts[0]["storage_key"])
    payload = json.loads(saved.read_text(encoding="utf-8"))
    assert payload["schemaVersion"] == 1


def test_worker_rejects_fake_model_agent(tmp_path: Path) -> None:
    store = MemoryStore()
    store.get_run = lambda run_id: {  # type: ignore[method-assign]
        "id": run_id,
        "agent_id": "agent-terminus",
        "task_version_id": "tv-1",
        "submission_id": "sub-1",
        "evaluator_configuration": {
            "schemaVersion": 1,
            "agentKind": "agent",
            "attemptCount": 1,
            "rewardRecipe": "binary",
            "sandboxProvider": "fake",
        },
    }
    config = EvaluatorConfig(
        supabase_url="http://127.0.0.1:15421",
        service_role_key="test",
        worker_id="test-worker",
        sandbox_provider="fake",
        harbor_bin="harbor",
        harbor_model="openai/gpt-4.1-mini",
        openai_base_url=None,
        openai_api_key=None,
        anthropic_api_key=None,
        anthropic_model=None,
        work_model_provider="openai",
        fixtures_dir="fixtures/eval",
        tb_fixtures_dir=None,
        artifact_dir=str(tmp_path),
        timeout_seconds=30,
        allow_fake=True,
        eval_image="python:3.12-slim",
        lease_seconds=900,
        git_sha=None,
        environments_dir="environments",
        byo_cmd=None,
        byo_http_url=None,
        enable_harbor=False,
    )
    with pytest.raises(RuntimeError, match="fake sandbox cannot run model agents"):
        process_job(
            store,  # type: ignore[arg-type]
            config,
            {
                "id": "job-1",
                "evaluation_run_id": "run-1",
                "organization_id": "00000000-0000-0000-0000-000000000001",
            },
        )


def test_write_json_artifact_hashes(tmp_path: Path) -> None:
    digest, size, key = write_json_artifact(
        str(tmp_path),
        organization_id="org",
        name="t.json",
        payload={"ok": True},
    )
    assert len(digest) == 64
    assert size > 0
    assert not key.startswith("/")
    assert ".." not in key
