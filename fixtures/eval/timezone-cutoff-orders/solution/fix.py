from pathlib import Path

Path("/workspace/app/cutoff.py").write_text(
    '''from datetime import datetime, timedelta, timezone

CUTOFF_HOUR = 17


def business_date(iso_stamp: str) -> str:
    parsed = datetime.fromisoformat(iso_stamp.replace("Z", "+00:00"))
    utc = parsed.astimezone(timezone.utc)
    day = utc.date()
    if utc.hour >= CUTOFF_HOUR:
        day = day + timedelta(days=1)
    return day.isoformat()
''',
    encoding="utf-8",
)
