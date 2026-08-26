"""Loopback HTTP BYO agent: skill-constraint oracle tool sequence.

Start on the evaluator host (not in Next.js):

    python examples/byo-work/server.py

Then:

    set AGENTFORGE_BYO_HTTP_URL=http://127.0.0.1:8765/byo
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ORACLE = [
    ("read_skill", {}),
    ("read_audit", {}),
    ("post_correction", {"text": "status corrected; audit retained per SKILL.md"}),
    ("close_ticket", {}),
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        del format, args

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send({"done": True})
            return
        history = payload.get("history")
        index = len(history) if isinstance(history, list) else 0
        if index >= len(ORACLE):
            self._send({"done": True})
            return
        name, arguments = ORACLE[index]
        self._send({"name": name, "arguments": arguments})

    def _send(self, body: dict[str, object]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
