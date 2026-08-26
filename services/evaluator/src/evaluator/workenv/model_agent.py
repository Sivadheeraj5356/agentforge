"""MCP tool-calling loop for work packs. Keys stay in the evaluator process."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Protocol

from evaluator.sandbox.protocol import TrialStep
class ToolCallingClient(Protocol):
    def list_tools(self) -> list[dict[str, Any]]: ...

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str: ...

HttpPost = Callable[[str, dict[str, str], dict[str, Any], float], dict[str, Any]]

DEFAULT_MAX_TURNS = 24
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class EvaluatorHarnessError(RuntimeError):
    """Operator-visible harness misconfiguration. Fail the job; do not score like NOP."""


class MissingWorkModelKeyError(EvaluatorHarnessError):
    """Raised when a reference model agent is queued without evaluator keys."""


class MissingByoCommandError(EvaluatorHarnessError):
    """Raised when a BYO agent is queued without evaluator BYO config."""


@dataclass(frozen=True)
class WorkModelConfig:
    provider: str
    openai_api_key: str | None
    anthropic_api_key: str | None
    openai_model: str
    anthropic_model: str
    openai_base_url: str | None = None
    max_turns: int = DEFAULT_MAX_TURNS


def require_work_model_key(config: WorkModelConfig) -> None:
    if config.provider == "anthropic":
        if not config.anthropic_api_key:
            raise MissingWorkModelKeyError(
                "ANTHROPIC_API_KEY is required on the evaluator for reference model agents."
            )
        return
    if not config.openai_api_key:
        raise MissingWorkModelKeyError(
            "OPENAI_API_KEY is required on the evaluator for reference model agents."
        )


def mcp_tools_as_openai(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []
    for tool in tools:
        name = str(tool.get("name") or "")
        if not name:
            continue
        schema = tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else {
            "type": "object",
            "properties": {},
        }
        converted.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": str(tool.get("description") or name),
                    "parameters": schema,
                },
            }
        )
    return converted


def mcp_tools_as_anthropic(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []
    for tool in tools:
        name = str(tool.get("name") or "")
        if not name:
            continue
        schema = tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else {
            "type": "object",
            "properties": {},
        }
        converted.append(
            {
                "name": name,
                "description": str(tool.get("description") or name),
                "input_schema": schema,
            }
        )
    return converted


def post_json(
    url: str, headers: dict[str, str], body: dict[str, Any], timeout: float
) -> dict[str, Any]:
    payload = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"model HTTP {error.code}: {detail}") from error
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError("model response must be an object")
    return parsed


def run_tool_loop(
    client: ToolCallingClient,
    *,
    instruction: str,
    config: WorkModelConfig,
    http_post: HttpPost | None = None,
    role: str = "agent",
) -> list[TrialStep]:
    require_work_model_key(config)
    poster = http_post or post_json
    tools = client.list_tools()
    if config.provider == "anthropic":
        return _anthropic_loop(client, instruction, config, poster, tools, role)
    return _openai_loop(client, instruction, config, poster, tools, role)


def _openai_loop(
    client: ToolCallingClient,
    instruction: str,
    config: WorkModelConfig,
    http_post: HttpPost,
    tools: list[dict[str, Any]],
    role: str,
) -> list[TrialStep]:
    base = (config.openai_base_url or "https://api.openai.com/v1").rstrip("/")
    url = f"{base}/chat/completions" if not base.endswith("/chat/completions") else base
    headers = {
        "Authorization": f"Bearer {config.openai_api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are an evaluation harness agent. Use the provided tools to complete the "
                "instruction. Hidden grader traps exist; do not wipe data or skip required surfaces."
            ),
        },
        {"role": "user", "content": instruction},
    ]
    openai_tools = mcp_tools_as_openai(tools)
    steps: list[TrialStep] = []
    index = 1
    for _ in range(config.max_turns):
        body: dict[str, Any] = {
            "model": _strip_provider_prefix(config.openai_model),
            "messages": messages,
        }
        if openai_tools:
            body["tools"] = openai_tools
        payload = http_post(url, headers, body, 90.0)
        choice = _first_choice(payload)
        message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
        messages.append(message if message else {"role": "assistant", "content": ""})
        tool_calls = message.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            break
        for call in tool_calls:
            if not isinstance(call, dict):
                continue
            function = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = str(function.get("name") or "")
            arguments = _parse_arguments(function.get("arguments"))
            observation = client.call_tool(name, arguments) if name else "missing tool name"
            steps.append(
                TrialStep(index, role, name, observation, state_hash=None)
            )
            index += 1
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": str(call.get("id") or f"call-{index}"),
                    "content": observation,
                }
            )
    return steps


def _anthropic_loop(
    client: ToolCallingClient,
    instruction: str,
    config: WorkModelConfig,
    http_post: HttpPost,
    tools: list[dict[str, Any]],
    role: str,
) -> list[TrialStep]:
    headers = {
        "x-api-key": str(config.anthropic_api_key),
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }
    messages: list[dict[str, Any]] = [{"role": "user", "content": instruction}]
    anthropic_tools = mcp_tools_as_anthropic(tools)
    steps: list[TrialStep] = []
    index = 1
    for _ in range(config.max_turns):
        body: dict[str, Any] = {
            "model": _strip_provider_prefix(config.anthropic_model),
            "max_tokens": 2048,
            "system": (
                "You are an evaluation harness agent. Use the provided tools to complete the "
                "instruction. Hidden grader traps exist; do not wipe data or skip required surfaces."
            ),
            "messages": messages,
        }
        if anthropic_tools:
            body["tools"] = anthropic_tools
        payload = http_post(ANTHROPIC_MESSAGES_URL, headers, body, 90.0)
        content = payload.get("content")
        blocks = content if isinstance(content, list) else []
        messages.append({"role": "assistant", "content": blocks})
        tool_uses = [block for block in blocks if isinstance(block, dict) and block.get("type") == "tool_use"]
        if not tool_uses:
            break
        results: list[dict[str, Any]] = []
        for block in tool_uses:
            name = str(block.get("name") or "")
            raw_input = block.get("input")
            arguments = raw_input if isinstance(raw_input, dict) else {}
            observation = client.call_tool(name, arguments) if name else "missing tool name"
            steps.append(TrialStep(index, role, name, observation, state_hash=None))
            index += 1
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": str(block.get("id") or f"tool-{index}"),
                    "content": observation,
                }
            )
        messages.append({"role": "user", "content": results})
    return steps


def _first_choice(payload: dict[str, Any]) -> dict[str, Any]:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        return choices[0]
    return {}


def _parse_arguments(raw: Any) -> dict[str, str]:
    if isinstance(raw, dict):
        return {str(key): str(value) for key, value in raw.items()}
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        if isinstance(parsed, dict):
            return {str(key): str(value) for key, value in parsed.items()}
    return {}


def _strip_provider_prefix(model: str) -> str:
    if "/" in model and model.split("/", 1)[0] in {"openai", "anthropic"}:
        return model.split("/", 1)[1]
    return model
