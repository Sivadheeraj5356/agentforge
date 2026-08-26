"""Isolated workspace host + fake-HTTP reference loop (no Docker)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from evaluator.sandbox.isolated_tools import IsolatedWorkspaceHost
from evaluator.workenv.model_agent import WorkModelConfig, run_tool_loop


def test_isolated_host_write_and_list(tmp_path: Path) -> None:
    host = IsolatedWorkspaceHost(tmp_path)
    assert "wrote app/main.py" in host.call_tool(
        "write_file",
        {"path": "app/main.py", "content": "ok = True\n"},
    )
    listing = host.call_tool("list_dir", {"path": "app"})
    assert "main.py" in listing
    assert "ok = True" in host.call_tool("read_file", {"path": "app/main.py"})
    assert "refusing hidden path" in host.call_tool("read_file", {"path": "/hidden/tests/x.py"})


def test_isolated_reference_fake_http_writes_file(tmp_path: Path) -> None:
    host = IsolatedWorkspaceHost(tmp_path)
    calls = {"n": 0}

    def fake_http(
        url: str, headers: dict[str, str], body: dict[str, Any], timeout: float
    ) -> dict[str, Any]:
        del url, headers, timeout
        calls["n"] += 1
        if calls["n"] == 1:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "function": {
                                        "name": "write_file",
                                        "arguments": '{"path":"fix.txt","content":"patched"}',
                                    },
                                }
                            ],
                        }
                    }
                ]
            }
        return {"choices": [{"message": {"role": "assistant", "content": "done"}}]}

    steps = run_tool_loop(
        host,
        instruction="Write fix.txt",
        config=WorkModelConfig(
            provider="openai",
            openai_api_key="sk-test",
            anthropic_api_key=None,
            openai_model="gpt-4.1-mini",
            anthropic_model="claude-sonnet-4-5",
        ),
        http_post=fake_http,
    )
    assert (tmp_path / "fix.txt").read_text(encoding="utf-8") == "patched"
    assert steps[0].command == "write_file"
