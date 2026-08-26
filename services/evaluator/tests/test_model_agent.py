from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from evaluator.workenv.mcp import McpClient, McpServer
from evaluator.workenv.model_agent import (
    MissingWorkModelKeyError,
    WorkModelConfig,
    mcp_tools_as_anthropic,
    mcp_tools_as_openai,
    require_work_model_key,
    run_tool_loop,
)
from evaluator.workenv.sandbox import WorkEnvironmentSandbox
from evaluator.workenv.world import seed_world

_ENVIRONMENTS = Path(__file__).resolve().parents[3] / "environments"


def test_require_key_openai() -> None:
    with pytest.raises(MissingWorkModelKeyError, match="OPENAI_API_KEY"):
        require_work_model_key(
            WorkModelConfig(
                provider="openai",
                openai_api_key=None,
                anthropic_api_key=None,
                openai_model="gpt-test",
                anthropic_model="claude-test",
            )
        )


def test_require_key_anthropic() -> None:
    with pytest.raises(MissingWorkModelKeyError, match="ANTHROPIC_API_KEY"):
        require_work_model_key(
            WorkModelConfig(
                provider="anthropic",
                openai_api_key="sk",
                anthropic_api_key=None,
                openai_model="gpt-test",
                anthropic_model="claude-test",
            )
        )


def test_tool_schema_conversion() -> None:
    tools = [
        {
            "name": "read_board",
            "description": "Read",
            "inputSchema": {"type": "object", "properties": {}},
        }
    ]
    openai = mcp_tools_as_openai(tools)
    anthropic = mcp_tools_as_anthropic(tools)
    assert openai[0]["function"]["name"] == "read_board"
    assert anthropic[0]["name"] == "read_board"
    assert anthropic[0]["input_schema"]["type"] == "object"


def test_scripted_openai_loop_mutates_world() -> None:
    world = seed_world()
    client = McpClient(McpServer(world))
    client.initialize()
    sequence = [
        ("search_messages", {"query": "EU payments"}),
        ("query_metrics", {"query": "eu-west"}),
        ("search_repo", {"query": "payment"}),
        ("rollback_release", {}),
        ("update_issue", {"key": "PAY-441", "comment": "ok"}),
        ("post_status", {"channel": "incidents", "text": "restored"}),
    ]
    state = {"i": 0}

    def fake_post(_url: str, _headers: dict[str, str], _body: dict, _timeout: float) -> dict:
        if state["i"] >= len(sequence):
            return {"choices": [{"message": {"role": "assistant", "content": "done"}}]}
        name, args = sequence[state["i"]]
        state["i"] += 1
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "id": f"call-{state['i']}",
                                "type": "function",
                                "function": {"name": name, "arguments": json.dumps(args)},
                            }
                        ],
                    }
                }
            ]
        }

    config = WorkModelConfig(
        provider="openai",
        openai_api_key="sk-test",
        anthropic_api_key=None,
        openai_model="gpt-test",
        anthropic_model="claude-test",
    )
    steps = run_tool_loop(
        client,
        instruction="restore EU payments",
        config=config,
        http_post=fake_post,
    )
    assert world.health_ok is True
    assert any(step.command == "rollback_release" for step in steps)


def test_work_sandbox_scripted_agent_beats_nop() -> None:
    sequence = [
        ("search_messages", {"query": "EU payments"}),
        ("query_metrics", {"query": "eu-west error_rate"}),
        ("search_repo", {"query": "payment router"}),
        ("rollback_release", {}),
        ("update_issue", {"key": "PAY-441", "comment": "Rolled back EU payment deploy; customers intact."}),
        ("post_status", {"channel": "incidents", "text": "EU payments restored after rollback."}),
    ]
    state = {"i": 0}

    def fake_post(_url: str, _headers: dict[str, str], _body: dict, _timeout: float) -> dict:
        if state["i"] >= len(sequence):
            return {"choices": [{"message": {"role": "assistant", "content": "done"}}]}
        name, args = sequence[state["i"]]
        state["i"] += 1
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "id": f"call-{state['i']}",
                                "function": {"name": name, "arguments": json.dumps(args)},
                            }
                        ],
                    }
                }
            ]
        }

    from evaluator.workenv import model_agent as model_agent_mod

    original = model_agent_mod.post_json
    model_agent_mod.post_json = fake_post  # type: ignore[method-assign]
    try:
        sandbox = WorkEnvironmentSandbox(
            str(_ENVIRONMENTS),
            work_model=WorkModelConfig(
                provider="openai",
                openai_api_key="sk-test",
                anthropic_api_key=None,
                openai_model="gpt-test",
                anthropic_model="claude-test",
            ),
        )
        agent = sandbox.run_trial(
            task_key="production-incident-eu-payments",
            agent_kind="agent",
            recipe="staged",
            timeout_seconds=30,
            pack_key="production-incident-eu-payments",
        )
        nop = sandbox.run_trial(
            task_key="production-incident-eu-payments",
            agent_kind="nop",
            recipe="staged",
            timeout_seconds=30,
            pack_key="production-incident-eu-payments",
        )
    finally:
        model_agent_mod.post_json = original  # type: ignore[method-assign]
    assert agent.reward == 1.0
    assert nop.reward < agent.reward


def test_work_sandbox_agent_without_config_raises() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS), work_model=None)
    with pytest.raises(MissingWorkModelKeyError):
        sandbox.run_trial(
            task_key="production-incident-eu-payments",
            agent_kind="agent",
            recipe="staged",
            timeout_seconds=30,
            pack_key="production-incident-eu-payments",
        )


@pytest.mark.skipif(os.environ.get("AGENTFORGE_LIVE_MODELS") != "1", reason="live models off")
def test_live_work_agent_optional() -> None:
    sandbox = WorkEnvironmentSandbox(
        str(_ENVIRONMENTS),
        work_model=WorkModelConfig(
            provider=os.environ.get("AGENTFORGE_WORK_MODEL_PROVIDER", "openai"),
            openai_api_key=os.environ.get("OPENAI_API_KEY"),
            anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
            openai_model=os.environ.get("HARBOR_MODEL", "gpt-4.1-mini"),
            anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
            openai_base_url=os.environ.get("OPENAI_BASE_URL"),
        ),
    )
    outcome = sandbox.run_trial(
        task_key="skill-constraint",
        agent_kind="agent",
        recipe="staged",
        timeout_seconds=120,
        pack_key="skill-constraint",
    )
    assert 0.0 <= outcome.reward <= 1.0
    assert len(outcome.steps) >= 1
