Work-pack BYO examples (skill-constraint oracle sequence).

HTTP (loopback on the evaluator host):

```bash
python examples/byo-work/server.py
set AGENTFORGE_BYO_HTTP_URL=http://127.0.0.1:8765/byo
```

Stdio line-JSON (same payload as HTTP, driven by `AGENTFORGE_BYO_CMD`):

```bash
set AGENTFORGE_BYO_CMD=python examples/byo-work/stdio_agent.py
```

Call listed MCP tools only. Do not invent live SaaS tokens. Exit the loop with `{"done": true}`. The hidden grader scores the world.
