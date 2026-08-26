"""Business-date cutoff. Calendar-prefix without UTC hour is the bug."""


def business_date(iso_stamp: str) -> str:
    return iso_stamp[:10]
