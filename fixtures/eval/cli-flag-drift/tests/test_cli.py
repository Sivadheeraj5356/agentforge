from app.cli import render


def test_v2_header() -> None:
    out = render(["--format=v2"])
    assert out.splitlines()[0] == "id,amount,status"
    assert "1,4.5,open" in out
    assert "2,9.0,paid" in out
    assert "id|amount" not in out
