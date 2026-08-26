# Product vision

AgentForge is evaluation infrastructure for AI agents that operate in real environments — especially terminal and coding agents.

## Problem

Teams building agent benchmarks and evaluation suites need:

1. Reproducible task definitions with immutable versions
2. Validated task packages (Harbor / Terminal Bench compatible)
3. Isolated execution of Oracle, NOP, and agent trials
4. Auditable artifacts, scores, and review workflows

Today these workflows are fragmented across ad-hoc scripts, local Docker, and spreadsheet tracking.

## Wedge

Focus on **task validation, Harbor-style evaluation, and private Agent Work Environments** before expanding to marketplace, fleet scheduling, or multi-product analytics. Scores come from the evaluator. Cost and tokens stay null until Harbor or a provider records them. There is no invented 28% / 54%.

## Principles

- **Reproducibility over demos** — immutable task versions, recorded configs, artifact retention
- **Safety by construction** — untrusted code never runs in the control plane
- **Adapter-first** — benchmarks, models, agents, sandboxes, and environments plug in behind stable interfaces
- **Operator clarity** — engineering-tool UX, not metric theater
