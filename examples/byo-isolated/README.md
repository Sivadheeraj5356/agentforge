Isolated BYO example for `broken-orders-api`.

The evaluator mounts this directory at `/opt/byo:ro` and runs `AGENTFORGE_BYO_CMD`.
The script edits `/workspace` only. The hidden grader scores the result. No model keys.

```bash
set AGENTFORGE_BYO_CMD=python /opt/byo/agent.py
```

Contract: edit the workspace, do not touch hidden tests, exit 0, we grade.
