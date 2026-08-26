"""BYO HTTP loop (no live operator process)."""

from __future__ import annotations

from typing import Any

import pytest

from evaluator.workenv.byo_agent import run_byo_stdio_loop, run_byo_work_loop
from evaluator.workenv.model_agent import MissingByoCommandError


class FakeClient:
    def list_tools(self) -> list[dict[str, Any]]:
        return [{"name": "write_file", "description": "write", "inputSchema": {"type": "object"}}]

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        return f"called {name} {arguments}"


def test_byo_requires_url() -> None:
    with pytest.raises(MissingByoCommandError, match="AGENTFORGE_BYO_HTTP_URL"):
        run_byo_work_loop(FakeClient(), instruction="go", url="")  # type: ignore[arg-type]


def test_byo_work_loop_calls_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    replies: list[dict[str, Any]] = [
        {"name": "write_file", "arguments": {"path": "a.txt", "content": "ok"}},
        {"done": True},
    ]

    def fake_post(
        url: str, headers: dict[str, str], body: dict[str, Any], timeout: float
    ) -> dict[str, Any]:
        del url, headers, body, timeout
        return replies.pop(0)

    monkeypatch.setattr("evaluator.workenv.byo_agent.post_json", fake_post)
    steps = run_byo_work_loop(
        FakeClient(),  # type: ignore[arg-type]
        instruction="write a.txt",
        url="http://127.0.0.1:9/byo",
    )
    assert steps[0].command == "write_file"
    assert "called write_file" in steps[0].observation


def test_byo_stdio_loop(tmp_path) -> None:
    import sys

    script = tmp_path / "stdio_agent.py"
    script.write_text(
        "import json, sys\n"
        "for line in sys.stdin:\n"
        "    msg = json.loads(line)\n"
        "    params = msg.get('params') or {}\n"
        "    history = params.get('history') or []\n"
        "    if history:\n"
        "        print(json.dumps({'done': True}), flush=True)\n"
        "    else:\n"
        "        print(json.dumps({'name': 'write_file', 'arguments': {'path': 'a.txt'}}), flush=True)\n",
        encoding="utf-8",
    )
    steps = run_byo_stdio_loop(
        FakeClient(),  # type: ignore[arg-type]
        instruction="write a.txt",
        command=f"{sys.executable} {script}",
    )
    assert steps[0].command == "write_file"
    assert "called write_file" in steps[0].observation


def test_isolated_missing_keys_without_docker() -> None:
    from evaluator.sandbox.isolated import IsolatedSandbox
    from evaluator.workenv.model_agent import MissingWorkModelKeyError

    fixtures = __import__("pathlib").Path(__file__).resolve().parents[3] / "fixtures" / "eval"
    sandbox = IsolatedSandbox(str(fixtures), byo_cmd=None)
    with pytest.raises(MissingByoCommandError, match="AGENTFORGE_BYO_CMD"):
        sandbox.run_trial(
            task_key="broken-orders-api",
            agent_kind="byo",
            recipe="binary",
            timeout_seconds=5,
        )
    with pytest.raises(MissingWorkModelKeyError):
        sandbox.run_trial(
            task_key="broken-orders-api",
            agent_kind="agent",
            recipe="binary",
            timeout_seconds=5,
        )
