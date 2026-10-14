# Glossary

| Term                   | Meaning                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Control plane**      | Trusted app (Next.js + APIs) that authenticates users, stores metadata, validates inputs, and enqueues jobs. Never executes user code. |
| **Execution plane**    | Isolated services/runners that materialize tasks and run trials in sandboxes.                                                          |
| **Organization (org)** | Tenant boundary for users, projects, billing, and data isolation.                                                                      |
| **Project**            | Container for related tasks and evaluations within an org.                                                                             |
| **Task**               | Logical evaluation unit (prompt/environment/tests).                                                                                    |
| **Task version**       | Immutable snapshot of a task definition used for runs.                                                                                 |
| **Benchmark adapter**  | Translator between external formats (Harbor, Terminal Bench, custom) and AgentForge's canonical task model.                            |
| **Oracle**             | Reference solution used to verify a task is solvable.                                                                                  |
| **NOP**                | No-op / null agent baseline to detect broken rewards or flaky tests.                                                                   |
| **Trial**              | One attempt with a 0–1 reward, metrics, failure category, and optional trajectory artifact.                                            |
| **Validation run**     | Structural ingest check of a task package. Not an evaluation run. No execution.                                                        |
| **Evaluation run**     | Pinned attempt (submission + versions + harness). Worker writes trials; Next.js does not execute.                                      |
| **Reward**             | Learning signal in `[0, 1]` from a recipe (binary / continuous / hybrid / staged). Staged scores are written by the evaluator.         |
| **Submission**         | Generic input handle (archive / git / generated / catalog / package) — metadata only until ingest.                                     |
| **Artifact**           | Stored file/log/trace produced by validation or trials (R2).                                                                           |
| **Harbor**             | Ecosystem / tooling for packing and running agent tasks in containers.                                                                 |
| **Terminus**           | Terminal-agent harness patterns related to Terminal Bench evaluations.                                                                 |
| **Experience pack**    | Saleable work environment: instruction, world, tools, hidden stage verifiers, reset.                                                   |
| **Work environment**   | Private executable world. Isolated for orders-ops; MCP in the evaluator for incidents, app-clone, and private-eval.                    |
