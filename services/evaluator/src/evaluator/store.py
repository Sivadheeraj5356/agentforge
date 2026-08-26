"""PostgREST client for the evaluator worker (service_role only)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class EvaluatorStore:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.rest = supabase_url.rstrip("/") + "/rest/v1"
        self.key = service_role_key

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        query: str = "",
        prefer: str = "return=representation",
    ) -> Any:
        url = f"{self.rest}{path}"
        if query:
            url = f"{url}?{query}"
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": prefer,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8")
            raise RuntimeError(f"store {method} {path} failed: {error.code} {detail}") from error
        if not raw:
            return None
        return json.loads(raw)

    def claim_job(self, worker_id: str) -> dict[str, Any] | None:
        result = self._request(
            "POST",
            "/rpc/claim_evaluation_job",
            body={"p_worker_id": worker_id},
        )
        if result is None or result == []:
            return None
        if isinstance(result, list):
            return result[0] if result else None
        return result

    def get_run(self, run_id: str) -> dict[str, Any]:
        rows = self._request("GET", "/evaluation_runs", query=f"id=eq.{run_id}&select=*")
        if not rows:
            raise RuntimeError("evaluation run not found")
        return rows[0]

    def get_agent(self, agent_id: str | None) -> dict[str, Any] | None:
        if not agent_id:
            return None
        rows = self._request("GET", "/agents", query=f"id=eq.{agent_id}&select=*")
        return rows[0] if rows else None

    def get_submission_kind(self, submission_id: str) -> str:
        rows = self._request("GET", "/submissions", query=f"id=eq.{submission_id}&select=kind")
        if not rows:
            raise RuntimeError("submission not found")
        return str(rows[0]["kind"])

    def get_eval_scenario(self, organization_id: str, key: str) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            "/eval_scenarios",
            query=f"organization_id=eq.{organization_id}&key=eq.{key}&select=id,key,request_text,trusted,verifier_pointer",
        )
        if not rows:
            return None
        return rows[0]

    def insert_artifact(self, row: dict[str, Any]) -> dict[str, Any]:
        created = self._request("POST", "/artifacts", body=row)
        if isinstance(created, list):
            return created[0]
        return created

    def get_task_key(self, task_version_id: str) -> str:
        rows = self._request(
            "GET",
            "/task_versions",
            query=f"id=eq.{task_version_id}&select=task_id,tasks(external_key)",
        )
        if not rows:
            raise RuntimeError("task version not found")
        tasks = rows[0].get("tasks")
        if isinstance(tasks, dict):
            return str(tasks["external_key"])
        nested = self._request(
            "GET",
            "/tasks",
            query=f"id=eq.{rows[0]['task_id']}&select=external_key",
        )
        return str(nested[0]["external_key"])

    def mark_job(self, job_id: str, status: str, last_error: str | None = None) -> None:
        body: dict[str, Any] = {"status": status}
        if last_error is not None:
            body["last_error"] = last_error[:2000]
        self._request("PATCH", "/evaluation_jobs", query=f"id=eq.{job_id}", body=body)

    def heartbeat_job(self, job_id: str, worker_id: str) -> None:
        self._request(
            "POST",
            "/rpc/heartbeat_evaluation_job",
            body={"p_job_id": job_id, "p_worker_id": worker_id},
        )

    def mark_run(self, run_id: str, status: str, started: bool, completed: bool) -> None:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        body: dict[str, Any] = {"status": status}
        if started:
            body["started_at"] = now
        if completed:
            body["completed_at"] = now
        self._request("PATCH", "/evaluation_runs", query=f"id=eq.{run_id}", body=body)

    def insert_trial(self, row: dict[str, Any]) -> dict[str, Any]:
        created = self._request("POST", "/evaluation_trials", body=row)
        if isinstance(created, list):
            return created[0]
        return created

    def insert_result(self, row: dict[str, Any]) -> None:
        self._request("POST", "/evaluation_results", body=row)

    def pin_run(self, run_id: str, git_sha: str | None, config_hash: str | None) -> None:
        body: dict[str, Any] = {}
        if git_sha:
            body["agent_git_sha"] = git_sha
        if config_hash:
            body["agent_config_hash"] = config_hash
        if not body:
            return
        self._request("PATCH", "/evaluation_runs", query=f"id=eq.{run_id}", body=body)

    def notify_run_terminal(self, run_id: str) -> None:
        self._request("POST", "/rpc/on_evaluation_run_terminal", body={"p_run_id": run_id})

    def pending_webhook_deliveries(self) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "/webhook_deliveries",
            query="status=eq.pending&select=id,endpoint_id,event,payload,signature,webhook_endpoints(url)",
        )
        return rows if isinstance(rows, list) else []

    def mark_webhook_delivery(self, delivery_id: str, status: str, last_error: str | None = None) -> None:
        body: dict[str, Any] = {"status": status}
        if last_error is not None:
            body["last_error"] = last_error[:2000]
        self._request("PATCH", "/webhook_deliveries", query=f"id=eq.{delivery_id}", body=body)

    def insert_rollout(self, row: dict[str, Any]) -> None:
        self._request("POST", "/rollouts", body=row)
