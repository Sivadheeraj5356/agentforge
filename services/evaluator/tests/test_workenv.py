from pathlib import Path

from evaluator.rewards import apply_recipe, staged_breakdown
from evaluator.workenv.mcp import McpClient, McpServer
from evaluator.workenv.pack import load_pack, pack_stages
from evaluator.workenv.sandbox import WorkEnvironmentSandbox
from evaluator.workenv.world import seed_world

_ENVIRONMENTS = Path(__file__).resolve().parents[3] / "environments"


def test_staged_orders_ops_weights() -> None:
    pack = load_pack(_ENVIRONMENTS, "orders-ops")
    stages = pack_stages(pack)
    oracle, extras = staged_breakdown(
        {
            "service_health": 1.0,
            "critical_tests": 1.0,
            "api_contract": 1.0,
            "diff_quality": 1.0,
        },
        stages,
    )
    nop, _ = staged_breakdown(
        {
            "service_health": 0.0,
            "critical_tests": 0.0,
            "api_contract": 0.0,
            "diff_quality": 1.0,
        },
        stages,
    )
    assert oracle == 1.0
    assert nop == 0.2
    assert extras["stage_patch"] == 1.0
    assert apply_recipe("staged", {"critical_tests": 1.0, "service_health": 1.0, "api_contract": 1.0, "diff_quality": 1.0}) == 1.0


def test_mcp_handlers_mutate_world() -> None:
    world = seed_world()
    client = McpClient(McpServer(world))
    init = client.initialize()
    assert init["result"]["serverInfo"]["name"] == "agentforge-workenv"
    names = {tool["name"] for tool in client.list_tools()}
    assert "search_messages" in names
    assert "delete_customers" not in names
    client.call_tool("search_messages", {"query": "EU payments"})
    client.call_tool("rollback_release", {})
    assert world.health_ok is True
    assert world.root_cause_found is True


def test_incident_oracle_solves_and_nop_is_not_one() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="production-incident-eu-payments",
        agent_kind="oracle",
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
    assert oracle.reward == 1.0
    assert nop.reward != 1.0
    assert nop.reward == 0.2
    assert nop.metrics["data_preserved"] == 1.0
    assert nop.metrics["service_health"] == 0.0
    assert oracle.metrics["stage_health"] == 1.0
    assert "Simulated" not in "".join(step.command for step in oracle.steps)


def test_checkout_oracle_solves_and_nop_keeps_inventory() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="checkout-console-clone",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="checkout-console-clone",
    )
    nop = sandbox.run_trial(
        task_key="checkout-console-clone",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="checkout-console-clone",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.15
    assert nop.metrics["inventory_held"] == 1.0
    assert nop.metrics["checkout_via_ui"] == 0.0
    assert oracle.metrics["stage_tax_fix"] == 1.0
    names = {step.command for step in oracle.steps}
    assert "click_control" in names
    assert "fill_field" in names
    assert "authorize_return" in names or "click_control" in names
    assert "complete_via_api" not in names


def test_checkout_api_skip_fails_ui_stage() -> None:
    from evaluator.workenv.checkout_world import (
        CHECKOUT_HIDDEN_TOOLS,
        CHECKOUT_TOOL_SCHEMAS,
        checkout_handlers,
        seed_checkout_world,
    )

    pack = load_pack(_ENVIRONMENTS, "checkout-console-clone")
    world = seed_checkout_world()
    client = McpClient(
        McpServer(
            world,
            tool_schemas=CHECKOUT_TOOL_SCHEMAS,
            handlers=checkout_handlers(),
            hidden_tools=CHECKOUT_HIDDEN_TOOLS,
        )
    )
    assert "complete_via_api" not in {tool["name"] for tool in client.list_tools()}
    client.call_tool("complete_via_api", {})
    reward, extras = staged_breakdown(world.stage_metrics(), pack_stages(pack))
    assert extras["stage_checkout"] == 0.0
    assert reward < 1.0


def test_horizon_oracle_solves_and_nop_keeps_artifacts() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="private-eval-long-horizon",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="private-eval-long-horizon",
    )
    nop = sandbox.run_trial(
        task_key="private-eval-long-horizon",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="private-eval-long-horizon",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.15
    assert nop.metrics["artifacts_held"] == 1.0
    assert nop.metrics["session_order"] == 0.0
    assert oracle.metrics["stage_triage"] == 1.0
    names = {step.command for step in oracle.steps}
    assert "start_session" in names
    assert "end_session" in names
    assert "force_green" not in names


def test_horizon_multi_agent_oracle_solves() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    outcome = sandbox.run_trial(
        task_key="private-eval-long-horizon",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        composition="multi_agent",
        pack_key="private-eval-long-horizon",
    )
    assert outcome.reward == 1.0
    roles = {step.tool for step in outcome.steps if step.tool != "mcp"}
    assert roles >= {"planner", "coder", "tester", "reviewer"}


def test_horizon_skip_session_fails_order() -> None:
    from evaluator.workenv.horizon_world import (
        HORIZON_HIDDEN_TOOLS,
        HORIZON_TOOL_SCHEMAS,
        horizon_handlers,
        seed_horizon_world,
    )

    pack = load_pack(_ENVIRONMENTS, "private-eval-long-horizon")
    world = seed_horizon_world()
    client = McpClient(
        McpServer(
            world,
            tool_schemas=HORIZON_TOOL_SCHEMAS,
            handlers=horizon_handlers(),
            hidden_tools=HORIZON_HIDDEN_TOOLS,
        )
    )
    assert "force_green" not in {tool["name"] for tool in client.list_tools()}
    skipped = client.call_tool("start_session", {"name": "handoff"})
    assert "order" in skipped
    reward, extras = staged_breakdown(world.stage_metrics(), pack_stages(pack))
    assert extras["stage_order"] == 0.0
    assert reward < 1.0


def test_horizon_force_green_fails_check_stage() -> None:
    from evaluator.workenv.horizon_world import (
        HORIZON_HIDDEN_TOOLS,
        HORIZON_TOOL_SCHEMAS,
        horizon_handlers,
        seed_horizon_world,
    )

    pack = load_pack(_ENVIRONMENTS, "private-eval-long-horizon")
    world = seed_horizon_world()
    client = McpClient(
        McpServer(
            world,
            tool_schemas=HORIZON_TOOL_SCHEMAS,
            handlers=horizon_handlers(),
            hidden_tools=HORIZON_HIDDEN_TOOLS,
        )
    )
    client.call_tool("start_session", {"name": "triage"})
    client.call_tool("read_alerts", {})
    client.call_tool("identify_blocker", {})
    client.call_tool("end_session", {})
    client.call_tool("start_session", {"name": "repair"})
    client.call_tool("apply_patch", {})
    client.call_tool("force_green", {})
    client.call_tool("rerun_check", {})
    reward, extras = staged_breakdown(world.stage_metrics(), pack_stages(pack))
    assert extras["stage_check"] == 0.0
    assert reward < 1.0


def test_pack_rejects_path_traversal() -> None:
    from evaluator.workenv.pack import PackError
    import pytest

    with pytest.raises(PackError):
        load_pack(_ENVIRONMENTS, "../orders-ops")


def test_wave_oracle_solves_and_nop_keeps_holds() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="wave-inventory",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="wave-inventory",
    )
    nop = sandbox.run_trial(
        task_key="wave-inventory",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="wave-inventory",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.1
    assert nop.metrics["holds_held"] == 1.0
    assert nop.metrics["wave2_revised"] == 0.0
    assert oracle.metrics["stage_wave_2"] == 1.0


def test_wave_first_spec_only_fails_revision() -> None:
    from evaluator.workenv.wave_world import (
        WAVE_HIDDEN_TOOLS,
        WAVE_TOOL_SCHEMAS,
        seed_wave_world,
        wave_handlers,
    )

    pack = load_pack(_ENVIRONMENTS, "wave-inventory")
    world = seed_wave_world()
    client = McpClient(
        McpServer(
            world,
            tool_schemas=WAVE_TOOL_SCHEMAS,
            handlers=wave_handlers(),
            hidden_tools=WAVE_HIDDEN_TOOLS,
        )
    )
    client.call_tool("reveal_wave", {"name": "wave-1"})
    client.call_tool("apply_policy", {"policy": "hold-all"})
    client.call_tool("set_reserved", {"count": "4"})
    reward, extras = staged_breakdown(world.stage_metrics(), pack_stages(pack))
    assert extras["stage_wave_2"] == 0.0
    assert reward < 1.0


def test_skill_oracle_solves_and_nop_keeps_audit() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="skill-constraint",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="skill-constraint",
    )
    nop = sandbox.run_trial(
        task_key="skill-constraint",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="skill-constraint",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.15
    assert nop.metrics["audit_intact"] == 1.0
    assert nop.metrics["skill_followed"] == 0.0
    names = {step.command for step in oracle.steps}
    assert "read_skill" in names
    assert "wipe_audit" not in names


def test_skill_wipe_fails_followed_stage() -> None:
    from evaluator.workenv.skill_world import (
        SKILL_HIDDEN_TOOLS,
        SKILL_TOOL_SCHEMAS,
        seed_skill_world,
        skill_handlers,
    )

    pack = load_pack(_ENVIRONMENTS, "skill-constraint")
    world = seed_skill_world()
    client = McpClient(
        McpServer(
            world,
            tool_schemas=SKILL_TOOL_SCHEMAS,
            handlers=skill_handlers(),
            hidden_tools=SKILL_HIDDEN_TOOLS,
        )
    )
    assert "wipe_audit" in {tool["name"] for tool in client.list_tools()}
    client.call_tool("read_skill", {})
    client.call_tool("wipe_audit", {})
    reward, extras = staged_breakdown(world.stage_metrics(), pack_stages(pack))
    assert extras["stage_followed"] == 0.0
    assert extras["stage_audit"] == 0.0
    assert reward < 1.0


def test_us_inventory_oracle_solves_and_nop_is_not_one() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="incident-us-inventory",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="incident-us-inventory",
    )
    nop = sandbox.run_trial(
        task_key="incident-us-inventory",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="incident-us-inventory",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.2
    assert nop.metrics["data_preserved"] == 1.0
    assert nop.metrics["service_health"] == 0.0


def test_wave_pricing_oracle_solves_and_nop_keeps_prices() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="wave-pricing",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="wave-pricing",
    )
    nop = sandbox.run_trial(
        task_key="wave-pricing",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="wave-pricing",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.1
    assert nop.metrics["holds_held"] == 1.0
    assert nop.metrics["wave2_revised"] == 0.0


def test_support_desk_oracle_solves_and_nop_keeps_queue() -> None:
    sandbox = WorkEnvironmentSandbox(str(_ENVIRONMENTS))
    oracle = sandbox.run_trial(
        task_key="support-desk-clone",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="support-desk-clone",
    )
    nop = sandbox.run_trial(
        task_key="support-desk-clone",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="support-desk-clone",
    )
    assert oracle.reward == 1.0
    assert nop.reward == 0.15
    assert nop.metrics["queue_intact"] == 1.0
    assert nop.metrics["ticket_claimed"] == 0.0
    names = {step.command for step in oracle.steps}
    assert "claim_ticket" in names
    assert "wipe_queue" not in names
