import {
  bullet,
  diagram,
  heading,
  paragraph,
  table,
  type DocsSection,
} from "../types";

export const ARCHITECTURE_SECTION: DocsSection = {
  id: "architecture",
  title: "Control plane and execution",
  group: "architecture",
  summary:
    "Trusted apps orchestrate. They never start sandboxes. Harbor-style execution, Isolated workspaces, and MCP worlds run only in the evaluator.",
  blocks: [
    paragraph(
      "Trusted apps orchestrate. They never start sandboxes. The Next.js app validates input, enforces org tenancy, and records what the worker wrote. Harbor-style execution, Isolated workspaces, and work MCP worlds (incident, app-clone, private-eval, evolving-spec, skill-follow) run only in services/evaluator.",
    ),
    diagram(
      [
        "┌─ apps/web (trusted control) ─────────────────────────┐",
        "│  Auth · RLS · Zod at HTTP and queue boundaries         │",
        "│  POST /api/v1/environments/start                       │",
        "│  GET  /api/v1/rollouts?kind=failed                     │",
        "│  Display trial.metrics — do not compute them           │",
        "└───────────────────────────┬────────────────────────────┘",
        "                            │ enqueue_evaluation",
        "                            ▼",
        "┌─ services/evaluator (execution) ─────────────────────┐",
        "│  Isolated Docker (no host socket)                     │",
        "│  Work MCP worlds (incident, clone, private-eval, waves)│",
        "│  Harbor (legacy flag only)                             │",
        "│  Hidden verifiers · staged reward · trajectory JSON   │",
        "└───────────────────────────────────────────────────────┘",
      ],
      "Control versus execution",
    ),
    heading("architecture-trust", "Trust boundaries"),
    table(
      ["Boundary", "Contract"],
      [
        ["HTTP", "StartEnvironmentInputSchema, ResetEnvironmentInputSchema, RolloutExportKindSchema"],
        ["Queue job", "EvaluatorConfigurationSchema (staged, packKey, sandboxProvider, attemptCount)"],
        ["Pack file", "ExperiencePackSchema in TS; load_pack weight sum in Python"],
        ["Tenancy", "organization_id on environment_versions, rollouts, trials; RLS on session queries"],
        ["Secrets", "Supabase service role is server-only. Never NEXT_PUBLIC_*"],
      ],
      "Validation at trust boundaries",
    ),
    heading("architecture-never", "What apps/web never does"),
    bullet([
      "Start Docker, MCP, or Harbor (legacy).",
      "Execute user-supplied code, commands, scripts, or task bundles.",
      "Grade the agent in the browser or accept a client-supplied reward.",
      "Mount Isolated /hidden into a user-writable volume.",
      "Call live Slack, GitHub, Jira, Grafana, or checkout-provider APIs for these packs.",
    ]),
    heading("architecture-adapters", "Adapters"),
    paragraph(
      "Benchmark, model, agent, sandbox, artifact, queue, environment, and CI check integrations sit behind adapters (BenchmarkAdapter, ModelProvider, AgentAdapter, SandboxProvider, ArtifactStore, JobQueue, EnvironmentAdapter, CiCheckAdapter). The work sandbox id is work. Isolated is isolated. The website does not construct those runtimes."),
  ],
};
