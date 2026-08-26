from app.cutoff import business_date


def test_morning_utc() -> None:
    assert business_date("2026-08-25T10:00:00Z") == "2026-08-25"


def test_after_cutoff_utc() -> None:
    assert business_date("2026-08-25T18:00:00Z") == "2026-08-26"


def test_offset_not_local() -> None:
    # 16:00 UTC is still the same UTC day even if a +05:30 clock reads 21:30.
    assert business_date("2026-08-25T16:00:00+05:30") == "2026-08-25"
