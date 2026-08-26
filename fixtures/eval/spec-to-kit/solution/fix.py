from pathlib import Path

Path("/workspace/app/cutlist_span.py").write_text(
    '''def cutlist_span(pieces: list[float], kerf: float) -> float:
    if kerf < 0 or any(piece < 0 for piece in pieces):
        raise ValueError("negative dimension")
    if not pieces:
        return 0.0
    return float(sum(pieces) + kerf * max(len(pieces) - 1, 0))
''',
    encoding="utf-8",
)
