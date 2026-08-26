"""Drive MCP tools from an operator BYO HTTP or stdio loop. Evaluator only."""

from __future__ import annotations

import json
import os
import shlex
import subprocess
from typing import Any, Protocol

from evaluator.sandbox.protocol import TrialStep
from evaluator.workenv.model_agent import (
    DEFAULT_MAX_TURNS,
    MissingByoCommandError,
    post_json,
)
from evaluator.workenv.mcp import McpClient


class ByoDecisionClient(Protocol):
    def list_tools(self) -> list[dict[str, Any]]: ...

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str: ...


def _parse_decision(payload: dict[str, Any]) -> tuple[str, dict[str, Any], bool]:
    if payload.get("jsonrpc") == "2.0" and isinstance(payload.get("result"), dict):
        payload = payload["result"]
    done = payload.get("done") is True or payload.get("stop") is True
    name = str(payload.get("name") or payload.get("tool") or "")
    raw_args = payload.get("arguments")
    arguments = raw_args if isinstance(raw_args, dict) else {}
    return name, arguments, done


def _apply_decision(
    client: ByoDecisionClient,
    payload: dict[str, Any],
    history: list[dict[str, Any]],
    index: int,
) -> TrialStep | None:
    name, arguments, done = _parse_decision(payload)
    if done or not name:
        return None
    observation = client.call_tool(name, arguments)
    history.append(
        {
            "name": name,
            "arguments": {str(key): str(value) for key, value in arguments.items()},
            "observation": observation[:4000],
        }
    )
    return TrialStep(index, "byo", name, observation)


def run_byo_work_loop(
    client: ByoDecisionClient,
    *,
    instruction: str,
    url: str,
    max_turns: int = DEFAULT_MAX_TURNS,
) -> list[TrialStep]:
    if not url.strip():
        raise MissingByoCommandError(
            "AGENTFORGE_BYO_HTTP_URL is required on the evaluator for work-pack BYO agents."
        )
    tools = client.list_tools()
    history: list[dict[str, Any]] = []
    steps: list[TrialStep] = []
    index = 1
    for _ in range(max_turns):
        payload = post_json(
            url,
            {"Content-Type": "application/json"},
            {
                "instruction": instruction,
                "tools": tools,
                "history": history,
            },
            90.0,
        )
        step = _apply_decision(client, payload, history, index)
        if step is None:
            break
        steps.append(step)
        index += 1
    return steps


def run_byo_stdio_loop(
    client: ByoDecisionClient,
    *,
    instruction: str,
    command: str,
    max_turns: int = DEFAULT_MAX_TURNS,
) -> list[TrialStep]:
    if not command.strip():
        raise MissingByoCommandError(
            "AGENTFORGE_BYO_CMD is required on the evaluator for work-pack stdio BYO agents."
        )
    tools = client.list_tools()
    argv = shlex.split(command, posix=os.name != "nt")
    process = subprocess.Popen(
        argv,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdin is not None
    assert process.stdout is not None
    history: list[dict[str, Any]] = []
    steps: list[TrialStep] = []
    index = 1
    try:
        for _ in range(max_turns):
            request = json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": index,
                    "method": "next",
                    "params": {
                        "instruction": instruction,
                        "tools": tools,
                        "history": history,
                    },
                }
            )
            process.stdin.write(request + "\n")
            process.stdin.flush()
            line = process.stdout.readline()
            if not line.strip():
                break
            parsed = json.loads(line)
            if not isinstance(parsed, dict):
                break
            step = _apply_decision(client, parsed, history, index)
            if step is None:
                break
            steps.append(step)
            index += 1
    finally:
        try:
            process.stdin.close()
        except OSError:
            pass
        process.kill()
        process.wait(timeout=5)
    return steps


def run_byo_work_agent(
    client: McpClient,
    *,
    instruction: str,
    http_url: str | None,
    command: str | None,
) -> list[TrialStep]:
    if http_url and http_url.strip():
        return run_byo_work_loop(client, instruction=instruction, url=http_url)
    if command and command.strip():
        return run_byo_stdio_loop(client, instruction=instruction, command=command)
    raise MissingByoCommandError(
        "AGENTFORGE_BYO_HTTP_URL or AGENTFORGE_BYO_CMD is required on the evaluator "
        "for work-pack BYO agents."
    )
