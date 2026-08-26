from evaluator.smoke import run_smoke


def test_in_process_smoke_oracle_and_nop() -> None:
    payload = run_smoke()
    assert payload["ok"] is True
    assert payload["oracleReward"] == 1.0
    assert payload["nopReward"] < 1.0
    assert payload["oracleSteps"] > 1
