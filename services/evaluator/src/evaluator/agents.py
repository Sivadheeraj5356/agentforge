"""Agent harness adapters. Live in the evaluator, never in Next.js."""

from __future__ import annotations

from dataclasses import dataclass

MULTI_AGENT_ROLES = ("planner", "coder", "tester", "reviewer")

ROLE_PROMPTS = {
    "planner": (
        "Read instruction.md and list the files in /workspace that must change. "
        "Do not edit hidden tests or grader paths."
    ),
    "coder": "Apply the planned fix in /workspace only. Do not touch tests or /hidden.",
    "tester": (
        "Run non-hidden sanity checks on the workspace API only. "
        "You cannot read /hidden; the grader owns hidden tests."
    ),
    "reviewer": (
        "Review the workspace diff. Reject edits that rewrite tests or touch grader paths."
    ),
}


def multi_agent_system_prompt() -> str:
    parts = [f"{role}: {prompt}" for role, prompt in ROLE_PROMPTS.items()]
    return (
        "Work as four roles in order. Hidden tests stay in the grader. "
        + " ".join(parts)
    )


@dataclass(frozen=True)
class AgentAdapter:
    id: str
    kind: str

    def harbor_agent_name(self) -> str:
        if self.kind in {"agent", "multi_agent"}:
            return "terminus-2"
        if self.kind in {"oracle", "nop"}:
            return self.kind
        raise ValueError(f"unsupported agent kind: {self.kind}")


def adapter_for(kind: str) -> AgentAdapter:
    if kind == "oracle":
        return AgentAdapter(id="agentforge/oracle/1.0.0", kind="oracle")
    if kind == "nop":
        return AgentAdapter(id="agentforge/nop/1.0.0", kind="nop")
    if kind == "multi_agent":
        return AgentAdapter(id="agentforge/multi-agent/1.0.0", kind="multi_agent")
    if kind == "agent":
        return AgentAdapter(id="agentforge/reference/1.0.0", kind="agent")
    if kind == "byo":
        return AgentAdapter(id="agentforge/byo/1.0.0", kind="byo")
    raise ValueError(f"unsupported agent kind: {kind}")
