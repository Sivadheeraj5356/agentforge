from evaluator.agents import MULTI_AGENT_ROLES, adapter_for, multi_agent_system_prompt


def test_adapter_catalog_ids() -> None:
    assert adapter_for("oracle").id == "agentforge/oracle/1.0.0"
    assert adapter_for("nop").harbor_agent_name() == "nop"
    assert adapter_for("agent").id == "agentforge/reference/1.0.0"
    assert adapter_for("byo").id == "agentforge/byo/1.0.0"
    assert adapter_for("multi_agent").id == "agentforge/multi-agent/1.0.0"


def test_multi_agent_roles_are_fixed() -> None:
    assert MULTI_AGENT_ROLES == ("planner", "coder", "tester", "reviewer")
    prompt = multi_agent_system_prompt()
    for role in MULTI_AGENT_ROLES:
        assert role in prompt
    assert "/hidden" in prompt
