from evaluator.config import load_config


def test_load_config_defaults_isolated_and_disallows_fake(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:15421")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-role")
    monkeypatch.delenv("SANDBOX_PROVIDER", raising=False)
    monkeypatch.delenv("ALLOW_FAKE", raising=False)
    config = load_config()
    assert config.sandbox_provider == "isolated"
    assert config.allow_fake is False
    assert config.eval_image == "agentforge-eval-python:3.12"


def test_load_config_reads_anthropic_and_work_provider(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:15421")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-role")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    monkeypatch.setenv("AGENTFORGE_WORK_MODEL_PROVIDER", "anthropic")
    monkeypatch.delenv("SANDBOX_PROVIDER", raising=False)
    config = load_config()
    assert config.anthropic_api_key == "sk-ant-test"
    assert config.anthropic_model == "claude-sonnet-4-5"
    assert config.work_model_provider == "anthropic"


def test_load_config_prefers_agentforge_env_aliases(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:15421")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-role")
    monkeypatch.setenv("AGENTFORGE_EVAL_IMAGE", "custom-eval:tag")
    monkeypatch.setenv("VORTEX_EVAL_IMAGE", "legacy-eval:tag")
    monkeypatch.setenv("AGENTFORGE_FIXTURES_DIR", "fixtures/custom")
    monkeypatch.setenv("AGENTFORGE_OPENAI_MODEL", "gpt-test")
    monkeypatch.delenv("SANDBOX_PROVIDER", raising=False)
    config = load_config()
    assert config.eval_image == "custom-eval:tag"
    assert config.fixtures_dir == "fixtures/custom"
    assert config.harbor_model == "gpt-test"


def test_load_config_stays_isolated_when_harbor_cli_exists(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:15421")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-role")
    monkeypatch.delenv("SANDBOX_PROVIDER", raising=False)
    config = load_config()
    assert config.sandbox_provider == "isolated"
    assert config.enable_harbor is False
