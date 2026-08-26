"""Static health payload. Does not accept task bytes."""

from evaluator.version import __version__


def healthcheck() -> dict[str, str]:
    return {
        "status": "ok",
        "version": __version__,
        "executes_user_code": "sandbox-only",
        "control_plane": "never",
    }
