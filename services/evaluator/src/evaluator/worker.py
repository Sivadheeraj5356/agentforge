"""Claim queued evaluation jobs and run them outside the control plane."""

from __future__ import annotations

import hashlib
import json
import threading
import traceback
import urllib.error
import urllib.request
from typing import Any

from evaluator.artifacts import write_json_artifact
from evaluator.config import EvaluatorConfig, load_config
from evaluator.runner import RunRequest, run_evaluation, trajectory_payload
from evaluator.store import EvaluatorStore
from evaluator.workenv.model_agent import EvaluatorHarnessError
from evaluator.workenv.pack import PackError, load_pack, pack_stages
from evaluator.workenv.sandbox import WORK_FAMILIES

MAX_TRAJECTORY_STEPS = 256
MAX_STEP_CHARS = 4000

USER_SAFE_FAILURE = "Evaluation could not be completed in the sandbox."
UNTRUSTED_KINDS = {"uploaded_archive", "git_repository", "git_commit"}
MODEL_KINDS = {"agent", "multi_agent", "byo"}


def agent_kind_from_row(run: dict[str, Any], agent: dict[str, Any] | None) -> str:
    config = run.get("evaluator_configuration") or {}
    if isinstance(config, dict) and config.get("agentKind"):
        return str(config["agentKind"])
    if agent and agent.get("name") in {"oracle", "nop", "byo"}:
        return str(agent["name"])
    if agent and agent.get("name") in {"reference", "terminus-2"}:
        return "agent"
    if agent and agent.get("name") == "multi-agent":
        return "multi_agent"
    return "oracle"


def model_snapshot_fields(kind: str, harbor_model: str | None) -> dict[str, str | None]:
    if kind not in MODEL_KINDS or not harbor_model:
        return {
            "model_provider": None,
            "model_id": None,
            "model_snapshot": None,
        }
    provider, sep, model_id = harbor_model.partition("/")
    if not sep:
        return {
            "model_provider": "unknown",
            "model_id": harbor_model,
            "model_snapshot": harbor_model,
        }
    return {
        "model_provider": provider,
        "model_id": model_id,
        "model_snapshot": harbor_model,
    }


def configuration_hash(config: dict[str, Any]) -> str:
    encoded = json.dumps(config, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _metrics_payload(trial: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {key: float(value) for key, value in trial.metrics.items()}
    payload["tool_calls"] = float(len(trial.steps))
    payload["latency_ms"] = float(trial.duration_ms)
    payload["cost_usd"] = None
    payload["prompt_tokens"] = None
    payload["completion_tokens"] = None
    payload["steps"] = [
        {
            "step": step.step,
            "tool": step.tool,
            "command": step.command[:MAX_STEP_CHARS],
            "observation": step.observation[:MAX_STEP_CHARS],
        }
        for step in trial.steps[:MAX_TRAJECTORY_STEPS]
    ]
    return payload


def _lease_heartbeat(
    store: EvaluatorStore, job_id: str, worker_id: str, interval: float
) -> threading.Event:
    stop = threading.Event()

    def beat() -> None:
        while not stop.wait(interval):
            try:
                store.heartbeat_job(job_id, worker_id)
            except Exception:
                return

    thread = threading.Thread(target=beat, name="agentforge-job-heartbeat", daemon=True)
    thread.start()
    return stop


def dispatch_webhooks(store: EvaluatorStore) -> None:
    for row in store.pending_webhook_deliveries():
        endpoints = row.get("webhook_endpoints")
        url = endpoints.get("url") if isinstance(endpoints, dict) else None
        if not url:
            store.mark_webhook_delivery(row["id"], "failed", last_error="missing endpoint url")
            continue
        body = json.dumps(row.get("payload") or {}).encode("utf-8")
        request = urllib.request.Request(
            str(url),
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AgentForge-Signature": str(row.get("signature") or ""),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10):
                store.mark_webhook_delivery(row["id"], "delivered")
        except urllib.error.URLError as error:
            store.mark_webhook_delivery(row["id"], "failed", last_error=str(error)[:2000])


def process_job(store: EvaluatorStore, config: EvaluatorConfig, job: dict[str, Any]) -> None:
    run_id = job["evaluation_run_id"]
    store.mark_job(job["id"], "running")
    store.heartbeat_job(job["id"], config.worker_id)
    stop_heartbeat = _lease_heartbeat(
        store, job["id"], config.worker_id, max(30.0, config.lease_seconds / 6)
    )
    try:
        store.mark_run(run_id, "running", started=True, completed=False)
        run = store.get_run(run_id)
        agent = store.get_agent(run.get("agent_id"))
        eval_config = run.get("evaluator_configuration") or {}
        if not isinstance(eval_config, dict):
            eval_config = {}
        recipe = str(eval_config.get("rewardRecipe") or "binary")
        attempts = int(eval_config.get("attemptCount") or 1)
        provider = str(eval_config.get("sandboxProvider") or config.sandbox_provider)
        timeout = int(eval_config.get("timeoutSeconds") or config.timeout_seconds)
        composition = str(eval_config.get("composition") or "single")
        kind = agent_kind_from_row(run, agent)
        if kind == "multi_agent":
            composition = "multi_agent"
        if kind in MODEL_KINDS and provider == "fake":
            raise RuntimeError("fake sandbox cannot run model agents")
        if provider == "fake" and not config.allow_fake:
            raise RuntimeError("fake sandbox is disabled")
        task_key = store.get_task_key(run["task_version_id"])
        submission_kind = store.get_submission_kind(run["submission_id"])
        org_id = job["organization_id"]
        pack_key = eval_config.get("packKey")
        if not pack_key:
            try:
                load_pack(config.environments_dir, task_key)
                pack_key = task_key
            except PackError:
                pack_key = None
        stages = None
        scenario_instruction = None
        scenario_key = eval_config.get("scenarioKey")
        if scenario_key:
            scenario = store.get_eval_scenario(str(org_id), str(scenario_key))
            if scenario:
                scenario_instruction = str(scenario.get("request_text") or "") or None
        if pack_key:
            try:
                pack = load_pack(config.environments_dir, str(pack_key))
            except PackError as error:
                raise RuntimeError(str(error)) from error
            stages = pack_stages(pack)
            recipe = "staged"
            if pack.get("family") in WORK_FAMILIES:
                provider = "work"
        allow_fake = (
            config.allow_fake
            and provider == "fake"
            and submission_kind not in UNTRUSTED_KINDS
            and kind not in MODEL_KINDS
        )
        request = RunRequest(
            task_key=task_key,
            agent_kind=kind,
            recipe=recipe,
            attempt_count=max(1, min(attempts, 8)),
            sandbox_provider=provider,
            timeout_seconds=timeout,
            fixtures_dir=config.fixtures_dir,
            harbor_bin=config.harbor_bin,
            task_dir=None if provider != "harbor" else f"{config.fixtures_dir}/{task_key}",
            allow_fake=allow_fake,
            composition=composition,
            harbor_model=config.harbor_model,
            openai_base_url=config.openai_base_url,
            openai_api_key=config.openai_api_key,
            anthropic_api_key=config.anthropic_api_key,
            anthropic_model=config.anthropic_model,
            work_model_provider=config.work_model_provider,
            eval_image=config.eval_image,
            pack_key=str(pack_key) if pack_key else None,
            environments_dir=config.environments_dir,
            stages=stages,
            scenario_instruction=scenario_instruction,
            byo_cmd=config.byo_cmd,
            byo_http_url=config.byo_http_url,
            enable_harbor=config.enable_harbor,
        )
        store.pin_run(run_id, config.git_sha, configuration_hash(eval_config))
        aggregated = run_evaluation(request)
        snapshot_model = config.harbor_model
        if kind in MODEL_KINDS and config.work_model_provider == "anthropic" and config.anthropic_model:
            snapshot_model = (
                config.anthropic_model
                if "/" in config.anthropic_model
                else f"anthropic/{config.anthropic_model}"
            )
        snapshot = model_snapshot_fields(kind, snapshot_model)
        for index, trial in enumerate(aggregated.trials, start=1):
            store.heartbeat_job(job["id"], config.worker_id)
            digest, byte_size, storage_key = write_json_artifact(
                config.artifact_dir,
                organization_id=org_id,
                name=f"trial-{index}-trajectory.json",
                payload={
                    "schemaVersion": 1,
                    "log": trial.log[-4000:],
                    "trajectory": trajectory_payload(trial),
                },
            )
            artifact = store.insert_artifact(
                {
                    "organization_id": org_id,
                    "kind": "json",
                    "content_hash": digest,
                    "byte_size": byte_size,
                    "content_type": "application/json",
                    "storage_key": storage_key,
                }
            )
            store.insert_trial(
                {
                    "evaluation_run_id": run_id,
                    "organization_id": org_id,
                    "attempt_index": index,
                    "status": "succeeded",
                    "reward": trial.reward,
                    "metrics": _metrics_payload(trial),
                    "failure_category": aggregated.failure_categories[index - 1],
                    "trajectory_artifact_id": artifact["id"],
                    "latency_ms": int(trial.duration_ms),
                    "cost_usd": None,
                    "prompt_tokens": None,
                    "completion_tokens": None,
                    **snapshot,
                }
            )
        passed = aggregated.pass_at_1 >= 1.0
        store.insert_result(
            {
                "evaluation_run_id": run_id,
                "result_kind": "score",
                "payload": {
                    "schemaVersion": 1,
                    "passed": passed,
                    "score": aggregated.mean_reward,
                    "passAt1": aggregated.pass_at_1,
                    "passAtK": aggregated.pass_at_k,
                    "k": aggregated.k,
                    "meanReward": aggregated.mean_reward,
                    "medianReward": aggregated.median_reward,
                    "meanLatencyMs": aggregated.mean_latency_ms,
                    "p95LatencyMs": aggregated.p95_latency_ms,
                    "meanToolCalls": aggregated.mean_tool_calls,
                    "costUsd": None,
                    "promptTokens": None,
                    "completionTokens": None,
                    "summary": f"{request.agent_kind} mean_reward={aggregated.mean_reward}",
                },
            }
        )
        store.mark_run(run_id, "succeeded", started=False, completed=True)
        env_version_id = run.get("environment_version_id") or eval_config.get("environmentVersionId")
        if isinstance(env_version_id, str) and env_version_id:
            store.insert_rollout(
                {
                    "organization_id": org_id,
                    "environment_version_id": env_version_id,
                    "task_version_id": run["task_version_id"],
                    "agent_id": run.get("agent_id"),
                    "seed": 0,
                    "evaluation_run_id": run_id,
                    "reward": aggregated.mean_reward,
                }
            )
        store.mark_job(job["id"], "succeeded")
        store.notify_run_terminal(run_id)
        dispatch_webhooks(store)
    finally:
        stop_heartbeat.set()


def worker_once(store: EvaluatorStore, config: EvaluatorConfig) -> bool:
    job = store.claim_job(config.worker_id)
    if not job:
        return False
    try:
        process_job(store, config, job)
    except EvaluatorHarnessError as error:
        store.mark_job(job["id"], "failed", last_error=str(error)[:2000])
        try:
            store.mark_run(job["evaluation_run_id"], "failed", started=False, completed=True)
            store.notify_run_terminal(job["evaluation_run_id"])
            dispatch_webhooks(store)
        except Exception:
            pass
        traceback.print_exc()
    except Exception:
        store.mark_job(job["id"], "failed", last_error=USER_SAFE_FAILURE)
        try:
            store.mark_run(job["evaluation_run_id"], "failed", started=False, completed=True)
            store.notify_run_terminal(job["evaluation_run_id"])
            dispatch_webhooks(store)
        except Exception:
            pass
        traceback.print_exc()
    return True


def main(argv: list[str] | None = None) -> None:
    import sys
    import time

    args = list(sys.argv[1:] if argv is None else argv)
    loop = "--loop" in args
    config = load_config()
    store = EvaluatorStore(config.supabase_url, config.service_role_key)
    while True:
        processed = worker_once(store, config)
        print("claimed" if processed else "idle", flush=True)
        if not loop:
            return
        if not processed:
            time.sleep(2)
