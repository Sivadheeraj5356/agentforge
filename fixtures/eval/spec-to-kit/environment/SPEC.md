# cutlist_span

Write `cutlist_span(pieces: list[float], kerf: float) -> float`.

- Empty `pieces` returns `0.0` regardless of kerf.
- Otherwise return `sum(pieces) + kerf * max(len(pieces) - 1, 0)`.
- Kerf is applied between pieces, not after the last piece.
- Raise `ValueError` if any piece is negative or kerf is negative.

This is an original AgentForge helper. It is not a public PyPI package.
