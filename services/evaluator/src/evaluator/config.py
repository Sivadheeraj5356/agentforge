"""Environment for the evaluator worker. Secrets stay server-side."""

from __future__ import annotations

from dataclasses import dataclass

from evaluator.env import env_first, env_flag

DEFAULT_TIMEOUT_SECONDS = 120
MAX_ATTEMPTS = 8
FORBIDDEN_SANDBOX_ARGS = ("docker.sock", "--privileged", "--pid=host", "--network=host")
DEFAULT_EVAL_IMAGE = "agentforge-eval-python:3.12"


@dataclass(frozen=True)
class EvaluatorConfig:
    supabase_url: str
    service_role_key: str
    worker_id: str
    sandbox_provider: str
    harbor_bin: str
    harbor_model: str | None
    openai_base_url: str | None
    openai_api_key: str | None
    anthropic_api_key: str | None
    anthropic_model: str | None
    work_model_provider: str
    fixtures_dir: str
    tb_fixtures_dir: str | None
    artifact_dir: str
    timeout_seconds: int
    allow_fake: bool
    eval_image: str
    lease_seconds: int
    git_sha: str | None
    environments_dir: str
    byo_cmd: str | None
    byo_http_url: str | None
    enable_harbor: bool


def load_config() -> EvaluatorConfig:
    url = env_first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    key = env_first("SUPABASE_SERVICE_ROLE_KEY", "EVALUATOR_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the worker")
    timeout_raw = env_first("EVALUATOR_TIMEOUT_SECONDS", default=str(DEFAULT_TIMEOUT_SECONDS))
    timeout = int(timeout_raw or str(DEFAULT_TIMEOUT_SECONDS))
    if timeout < 1 or timeout > 86_400:
        raise RuntimeError("EVALUATOR_TIMEOUT_SECONDS out of range")
    lease = int(env_first("EVALUATOR_LEASE_SECONDS", default="900") or "900")
    if lease < 60 or lease > 86_400:
        raise RuntimeError("EVALUATOR_LEASE_SECONDS out of range")
    harbor_bin = env_first("AGENTFORGE_HARBOR_BIN", "HARBOR_BIN", default="harbor") or "harbor"
    explicit = env_first("SANDBOX_PROVIDER", "AGENTFORGE_SANDBOX_PROVIDER")
    if explicit:
        provider = explicit.strip().lower()
    else:
        provider = "isolated"
    git_sha = env_first("AGENTFORGE_GIT_SHA", "VORTEX_GIT_SHA", "GITHUB_SHA")
    if git_sha and not (7 <= len(git_sha) <= 40):
        git_sha = None
    elif git_sha:
        git_sha = git_sha.lower()
    return EvaluatorConfig(
        supabase_url=url.rstrip("/"),
        service_role_key=key,
        worker_id=env_first("EVALUATOR_WORKER_ID", "AGENTFORGE_WORKER_ID", default="evaluator-1")
        or "evaluator-1",
        sandbox_provider=provider,
        harbor_bin=harbor_bin,
        harbor_model=env_first(
            "AGENTFORGE_OPENAI_MODEL",
            "AGENTFORGE_HARBOR_MODEL",
            "HARBOR_MODEL",
        ),
        openai_base_url=env_first("OPENAI_BASE_URL"),
        openai_api_key=env_first("OPENAI_API_KEY"),
        anthropic_api_key=env_first("ANTHROPIC_API_KEY"),
        anthropic_model=env_first("ANTHROPIC_MODEL", "AGENTFORGE_ANTHROPIC_MODEL"),
        work_model_provider=(
            env_first("AGENTFORGE_WORK_MODEL_PROVIDER", default="openai") or "openai"
        )
        .strip()
        .lower(),
        fixtures_dir=env_first("AGENTFORGE_FIXTURES_DIR", "VORTEX_FIXTURES_DIR", default="fixtures/eval")
        or "fixtures/eval",
        tb_fixtures_dir=env_first("TB_FIXTURES_DIR", "AGENTFORGE_TB_FIXTURES_DIR"),
        artifact_dir=env_first(
            "AGENTFORGE_EVAL_ARTIFACT_DIR",
            "VORTEX_EVAL_ARTIFACT_DIR",
            default=".data/eval-artifacts",
        )
        or ".data/eval-artifacts",
        timeout_seconds=timeout,
        allow_fake=env_flag("ALLOW_FAKE", "AGENTFORGE_ALLOW_FAKE", default=False),
        eval_image=env_first("AGENTFORGE_EVAL_IMAGE", "VORTEX_EVAL_IMAGE", default=DEFAULT_EVAL_IMAGE)
        or DEFAULT_EVAL_IMAGE,
        lease_seconds=lease,
        git_sha=git_sha,
        environments_dir=env_first("AGENTFORGE_ENVIRONMENTS_DIR", default="environments")
        or "environments",
        byo_cmd=env_first("AGENTFORGE_BYO_CMD"),
        byo_http_url=env_first("AGENTFORGE_BYO_HTTP_URL"),
        enable_harbor=env_flag("AGENTFORGE_ENABLE_HARBOR"),
    )
