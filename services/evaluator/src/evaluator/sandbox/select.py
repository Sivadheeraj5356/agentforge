"""Select a sandbox. Untrusted uploads must not fall back to FakeSandbox."""

from __future__ import annotations

from evaluator.sandbox.fake import FakeSandbox
from evaluator.sandbox.harbor import HarborSandbox
from evaluator.sandbox.isolated import IsolatedSandbox
from evaluator.sandbox.protocol import TrialOutcome
from evaluator.workenv.sandbox import WorkEnvironmentSandbox


def select_sandbox(
    provider: str,
    *,
    fixtures_dir: str,
    harbor_bin: str,
    allow_fake: bool,
    harbor_model: str | None = None,
    openai_base_url: str | None = None,
    openai_api_key: str | None = None,
    anthropic_api_key: str | None = None,
    anthropic_model: str | None = None,
    work_model_provider: str = "openai",
    eval_image: str | None = None,
    environments_dir: str | None = None,
    byo_cmd: str | None = None,
    byo_http_url: str | None = None,
    enable_harbor: bool = False,
):
    if provider == "harbor":
        if not enable_harbor:
            raise RuntimeError(
                "Harbor/Terminus-2 is retired. Use isolated or work. "
                "Set AGENTFORGE_ENABLE_HARBOR=1 only for legacy jobs."
            )
        return HarborSandbox(
            harbor_bin,
            model=harbor_model,
            openai_base_url=openai_base_url,
            openai_api_key=openai_api_key,
            anthropic_api_key=anthropic_api_key,
        )
    if provider == "isolated":
        from evaluator.workenv.model_agent import WorkModelConfig

        work_model = WorkModelConfig(
            provider=work_model_provider if work_model_provider in {"openai", "anthropic"} else "openai",
            openai_api_key=openai_api_key,
            anthropic_api_key=anthropic_api_key,
            openai_model=harbor_model or "gpt-4.1-mini",
            anthropic_model=anthropic_model or "claude-sonnet-4-5",
            openai_base_url=openai_base_url,
        )
        return IsolatedSandbox(
            fixtures_dir,
            eval_image=eval_image,
            environments_dir=environments_dir,
            work_model=work_model,
            byo_cmd=byo_cmd,
        )
    if provider == "work":
        if not environments_dir:
            raise RuntimeError("work sandbox requires AGENTFORGE_ENVIRONMENTS_DIR")
        from evaluator.workenv.model_agent import WorkModelConfig

        work_model = WorkModelConfig(
            provider=work_model_provider if work_model_provider in {"openai", "anthropic"} else "openai",
            openai_api_key=openai_api_key,
            anthropic_api_key=anthropic_api_key,
            openai_model=harbor_model or "gpt-4.1-mini",
            anthropic_model=anthropic_model or "claude-sonnet-4-5",
            openai_base_url=openai_base_url,
        )
        return WorkEnvironmentSandbox(
            environments_dir,
            work_model=work_model,
            byo_http_url=byo_http_url,
            byo_cmd=byo_cmd,
        )
    if provider == "fake":
        if not allow_fake:
            raise RuntimeError("fake sandbox is not allowed for untrusted jobs")
        return FakeSandbox()
    raise RuntimeError(f"unknown sandbox provider: {provider}")


def run_with_optional_task_dir(sandbox, **kwargs) -> TrialOutcome:
    extras = {
        "pack_key": kwargs.pop("pack_key", None),
        "environments_dir": kwargs.pop("environments_dir", None),
        "stages": kwargs.pop("stages", None),
        "scenario_instruction": kwargs.pop("scenario_instruction", None),
    }
    if isinstance(sandbox, HarborSandbox):
        task_dir = kwargs.pop("task_dir")
        return sandbox.run_trial(**kwargs, task_dir=task_dir)
    kwargs.pop("task_dir", None)
    return sandbox.run_trial(**kwargs, **extras)
