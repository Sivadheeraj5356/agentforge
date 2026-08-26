# ADR-018: Harbor sandbox isolation in the execution plane

## Status

Accepted

## Context

Chunks 1–7 left `SandboxProvider` as an interface. Evaluating a task requires starting containers. Doing that in Next.js would violate ADR-002.

Harbor already splits the **agent** environment from the **grader** environment. Hidden tests must not be on the agent filesystem. Host Docker sockets and `--privileged` are an escape hatch.

## Decision

- Implement sandboxes only in `services/evaluator`.
- `HarborSandbox` shells out to `harbor run --path … --agent oracle|nop|terminus-2 --jobs-dir <temp>`. Harbor has no `--timeout` seconds flag; Vortex caps the subprocess and refuses `docker.sock`, `--privileged`, `--pid=host`, and `--network=host`.
- `IsolatedSandbox` is a Docker fallback with two `docker run` invocations: agent (workspace only) then grader (`/hidden:ro`).
- `FakeSandbox` is for **unit tests** of catalog fixtures. It is **not** allowed for `uploaded_archive` (or other untrusted submission kinds) and is not the local product path.
- Control plane enqueues opaque ids via `enqueue_evaluation`. It never starts Docker or Harbor.
- Terminus-2 and OpenAI-compatible keys are evaluator-only (ADR-021).

## Consequences

- Local eval without Harbor is Isolated + Docker (`agentforge-eval-python:3.12`), not Fake.
- Production-like runs need Docker Desktop (isolated) or a Harbor install (harbor).
- Agent vs grader isolation is a code invariant, not a UI toggle.
