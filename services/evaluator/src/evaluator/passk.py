"""Unbiased pass@k (Chen et al.)."""

from __future__ import annotations

import math


def pass_at_k(n: int, c: int, k: int) -> float:
    if n < 1 or c < 0 or c > n or k < 1:
        raise ValueError("pass@k arguments out of range")
    if n - c < k:
        return 1.0
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)
