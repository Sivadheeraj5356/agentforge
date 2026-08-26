from evaluator import __version__, healthcheck


def test_healthcheck_is_sandbox_only() -> None:
    payload = healthcheck()
    assert payload["status"] == "ok"
    assert payload["executes_user_code"] == "sandbox-only"
    assert payload["control_plane"] == "never"
    assert payload["version"] == __version__
