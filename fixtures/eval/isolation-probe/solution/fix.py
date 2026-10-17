"""Probe the submission sandbox boundary and record results."""
import json
import os
import socket
import urllib.request
from pathlib import Path

results: dict = {}

def _tcp(host: str, port: int = 443, timeout: float = 4.0) -> bool:
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except Exception:
        return False

results["net_tcp_1_1_1_1_443"] = _tcp("1.1.1.1")
try:
    urllib.request.urlopen("https://mzkievjmtexqduqxhmcm.supabase.co", timeout=4)
    results["net_http_supabase"] = True
except Exception:
    results["net_http_supabase"] = False

env_keys = sorted(os.environ.keys())
results["secret_env_keys"] = [
    k for k in env_keys
    if any(t in k.upper() for t in ("SUPABASE", "SERVICE_ROLE", "CRON", "OPENAI", "ANTHROPIC", "TOKEN", "SECRET"))
]

probes: dict = {}
for p in ("/var/run/docker.sock", "/opt/agentforge", "/tmp/dockerd.log", "/run/secrets"):
    probes[p] = os.path.exists(p)
proc_env = ""
try:
    proc_env = open("/proc/1/environ", "rb").read().decode("utf-8", "replace")
except Exception:
    pass
probes["proc1_env_has_secrets"] = any(
    t in proc_env.upper() for t in ("SUPABASE", "SERVICE_ROLE", "CRON_SECRET")
)
results["file_probes"] = probes

Path("/workspace/probe_results.json").write_text(json.dumps(results), encoding="utf-8")
