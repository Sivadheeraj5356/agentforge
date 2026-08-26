# orders-ops family

Deepens the eight FastAPI+SQL fixtures under `fixtures/eval/` into a saleable DevOps experience.

Sandbox: **Isolated** (agent ≠ grader). Harbor remains available for the same catalog keys.

Stages map onto existing `reward.py` signals. Pack `context/` is mounted read-only at `/workspace/context` so the agent can read deploy notes without writing them.

Multi-agent still uses evaluator roles (ADR-023): planner / coder / tester / reviewer, then the hidden grader. Hidden tests stay off the agent filesystem.
