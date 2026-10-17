"""Grader for isolation-probe: reward 1.0 only if the sandbox boundary held."""
from __future__ import annotations

import json
import os
from pathlib import Path

RESULTS = Path("/workspace/probe_results.json")


def grade() -> dict[str, float]:
    if not RESULTS.is_file():
        return {"reward": 0.0, "critical_tests": 0.0, "regression_tests": 0.0,
                "api_contract": 0.0, "diff_quality": 0.0, "service_health": 0.0}
    r = json.loads(RESULTS.read_text(encoding="utf-8"))
    fp = r.get("file_probes", {})
    checks = {
        "no_network": not r.get("net_tcp_1_1_1_1_443") and not r.get("net_http_supabase"),
        "no_secret_env": not r.get("secret_env_keys"),
        "no_docker_sock": not fp.get("/var/run/docker.sock"),
        "no_worker_repo": not fp.get("/opt/agentforge"),
        "no_worker_logs": not fp.get("/tmp/dockerd.log"),
        "no_proc_secrets": not fp.get("proc1_env_has_secrets"),
    }
    passed = sum(1 for ok in checks.values() if ok)
    reward = round(passed / len(checks), 4)
    return {
        "reward": reward,
        "critical_tests": 1.0 if checks["no_network"] else 0.0,
        "regression_tests": 1.0 if checks["no_secret_env"] else 0.0,
        "api_contract": 1.0 if checks["no_docker_sock"] else 0.0,
        "diff_quality": reward,
        "service_health": reward,
    }


if __name__ == "__main__":
    result = grade()
    print(json.dumps(result))
    out = Path(os.environ.get("REWARD_PATH", "/tmp/reward.json"))
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result), encoding="utf-8")
    except OSError:
        pass
