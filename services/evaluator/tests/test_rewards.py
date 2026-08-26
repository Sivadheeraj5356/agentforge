from evaluator.failure_taxonomy import classify_failure
from evaluator.passk import pass_at_k
from evaluator.rewards import apply_recipe, binary_reward, continuous_outcome_reward, hybrid_reward


def test_binary_and_continuous_recipes() -> None:
    assert binary_reward(True) == 1.0
    assert binary_reward(False) == 0.0
    assert (
        continuous_outcome_reward(
            {
                "critical_tests": 1,
                "regression_tests": 0.75,
                "api_contract": 1,
                "diff_quality": 0.5,
                "service_health": 1,
            }
        )
        == 0.9
    )
    assert hybrid_reward({"outcome": 1, "efficiency": 0, "safety": 1, "correctness": 0}) == 0.7


def test_pass_at_k() -> None:
    assert pass_at_k(3, 3, 1) == 1.0
    assert pass_at_k(3, 0, 1) == 0.0
    assert abs(pass_at_k(3, 1, 1) - (1 / 3)) < 1e-9


def test_taxonomy_is_deterministic() -> None:
    assert (
        classify_failure(
            agent_kind="nop",
            reward=0.0,
            metrics={"critical_tests": 0.0, "diff_quality": 1.0},
            timed_out=False,
            grader_tampered=False,
            tool_calls=0,
        )
        == "verification"
    )
    assert (
        classify_failure(
            agent_kind="oracle",
            reward=1.0,
            metrics={"critical_tests": 1.0},
            timed_out=False,
            grader_tampered=False,
            tool_calls=1,
        )
        == "none"
    )
    assert (
        classify_failure(
            agent_kind="agent",
            reward=0.0,
            metrics={"critical_tests": 0.0, "diff_quality": 0.0},
            timed_out=False,
            grader_tampered=True,
            tool_calls=1,
        )
        == "destructive_action"
    )
    assert apply_recipe("binary", {"critical_tests": 1.0}) == 1.0
    assert apply_recipe("staged", {"critical_tests": 1.0, "service_health": 1.0, "api_contract": 1.0, "diff_quality": 1.0}) == 1.0
