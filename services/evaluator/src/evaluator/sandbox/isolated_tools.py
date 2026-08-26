"""Workspace tools for Isolated reference agents. Keys stay in the evaluator."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from evaluator.config import FORBIDDEN_SANDBOX_ARGS

ISOLATED_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "list_dir",
        "description": "List files under /workspace (relative path).",
        "inputSchema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
        },
    },
    {
        "name": "read_file",
        "description": "Read a UTF-8 file under /workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write a UTF-8 file under /workspace. Do not write hidden tests.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a command in the Isolated agent container with cwd /workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"],
        },
    },
]


class IsolatedWorkspaceHost:
    """Tool host bound to the agent workspace. Hidden tests are not on this tree."""

    def __init__(
        self,
        workspace: Path,
        *,
        image: str | None = None,
        extra_mounts: list[str] | None = None,
        timeout_seconds: int = 30,
        run_command_fn: Any | None = None,
    ) -> None:
        self.workspace = workspace.resolve()
        self.image = image
        self.extra_mounts = extra_mounts or []
        self.timeout_seconds = timeout_seconds
        self._run_command_fn = run_command_fn

    def list_tools(self) -> list[dict[str, Any]]:
        return list(ISOLATED_TOOL_SCHEMAS)

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        args = arguments or {}
        if name == "list_dir":
            return self._list_dir(str(args.get("path") or "."))
        if name == "read_file":
            return self._read_file(str(args.get("path") or ""))
        if name == "write_file":
            return self._write_file(str(args.get("path") or ""), str(args.get("content") or ""))
        if name == "run_command":
            return self._run_command(str(args.get("command") or ""))
        return f"unknown tool {name}"

    def _safe_path(self, raw: str) -> Path:
        relative = raw.strip() or "."
        if relative.startswith("/workspace/"):
            relative = relative[len("/workspace/") :]
        elif relative == "/workspace":
            relative = "."
        lowered = relative.replace("\\", "/").lower()
        if lowered.startswith("/hidden") or "/hidden/" in lowered or lowered.endswith("/hidden"):
            raise ValueError("refusing hidden path")
        if ".." in Path(relative).parts:
            raise ValueError("refusing parent path")
        candidate = (self.workspace / relative).resolve()
        candidate.relative_to(self.workspace)
        return candidate

    def _list_dir(self, raw: str) -> str:
        try:
            target = self._safe_path(raw)
        except ValueError as error:
            return str(error)
        if not target.exists():
            return "missing path"
        if target.is_file():
            return target.name
        names = sorted(path.name for path in target.iterdir())
        return "\n".join(names) if names else "(empty)"

    def _read_file(self, raw: str) -> str:
        try:
            target = self._safe_path(raw)
        except ValueError as error:
            return str(error)
        if not target.is_file():
            return "missing file"
        return target.read_text(encoding="utf-8", errors="replace")[:8000]

    def _write_file(self, raw: str, content: str) -> str:
        try:
            target = self._safe_path(raw)
        except ValueError as error:
            return str(error)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"wrote {target.relative_to(self.workspace).as_posix()}"

    def _run_command(self, command: str) -> str:
        joined = command.strip()
        if not joined:
            return "empty command"
        for token in FORBIDDEN_SANDBOX_ARGS:
            if token in joined:
                return f"refusing command token: {token}"
        if "/hidden" in joined or "docker.sock" in joined:
            return "refusing command token"
        if self._run_command_fn is not None:
            return str(self._run_command_fn(joined))
        if self.image is None:
            return "run_command requires Isolated Docker"
        from evaluator.sandbox.isolated import _run_agent

        return _run_agent(
            self.workspace,
            self.image,
            ["sh", "-c", joined],
            self.timeout_seconds,
            self.extra_mounts,
        )[-4000:]
