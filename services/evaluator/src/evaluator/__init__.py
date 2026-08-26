"""AgentForge execution-plane evaluator.

Runs Oracle / NOP (and later agents) in isolated sandboxes. The Next.js
control plane never imports this package and never starts containers.
"""

from .health import healthcheck
from .version import __version__

__all__ = ["__version__", "healthcheck"]
