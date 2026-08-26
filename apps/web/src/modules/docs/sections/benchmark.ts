import { heading, note, paragraph, table, type DocsSection } from "../types";

export const BENCHMARK_SECTION: DocsSection = {
  id: "benchmark",
  title: "AgentForge Horizon",
  group: "product",
  summary:
    "A private staged-RLVR workbench with original T2/T3 tasks. Not SWE-bench, not Terminal-Bench, not a Fable 5 leaderboard.",
  blocks: [
    paragraph(
      "AgentForge Horizon is a private staged-RLVR workbench: hidden graders, anti-cheat traps, full failed rollouts, simulated multi-surface apps, and a small set of original T2/T3 tasks. It is not SWE-bench, not Terminal-Bench, and not a Fable 5 leaderboard.",
    ),
    heading("benchmark-taxonomy", "Task-horizon vocabulary"),
    paragraph(
      "We use the Awesome Long-Horizon SE Agents T0–T3 vocabulary to describe task structure, not trajectory length. A long search–edit–test loop on one bug stays T1.",
    ),
    table(
      ["Level", "What it means here", "Shipped examples"],
      [
        ["T0", "Local bounded coding", "Not our wedge"],
        ["T1", "One engineering objective, possibly a long procedural trace", "broken-orders-api and Isolated siblings"],
        ["T2", "Several independently verifiable engineering obligations", "ledger-evolve, spec-to-kit, checkout-console-clone, skill-constraint"],
        ["T3", "The specification itself changes or sessions must be ordered", "wave-inventory, private-eval-long-horizon"],
      ],
      "Horizon taxonomy as used in AgentForge",
    ),
    heading("benchmark-original", "Original tasks, not vendored instances"),
    paragraph(
      "Research lists (SWE-EVO, DeNovoSWE, skills.git, Awesome Long-Horizon SE Agents) informed the jobs. Catalog rows are original AgentForge fixtures and simulated worlds. We do not ship Django/NumPy histories, Hugging Face instance dumps, or third-party SKILL.md files.",
    ),
    table(
      ["Task / pack", "Job", "Sandbox"],
      [
        ["ledger-evolve (horizon-swe)", "Idempotent POST, migrate rows, update CLI", "isolated"],
        ["spec-to-kit", "Implement cutlist_span from SPEC.md; forbidden lookalike imports", "isolated"],
        ["wave-inventory", "Three waves; wave 2 revises wave 1", "work"],
        ["skill-constraint", "Follow SKILL.md: never wipe the audit log", "work"],
      ],
      "Horizon v1 original set",
    ),
    heading("benchmark-simulated", "What is simulated"),
    paragraph(
      "Work packs use in-process MCP worlds labeled Simulated. The control plane refuses live Gmail, Slack, Salesforce, and other SaaS OAuth. Isolated tasks run FastAPI fixtures in Docker. Keys for model agents live on the evaluator worker (OPENAI_API_KEY, ANTHROPIC_API_KEY). They are never NEXT_PUBLIC_*.",
    ),
    heading("benchmark-protocol", "Horizon v1 protocol"),
    paragraph(
      "Protocol pin horizon-v1.0.0: pinned environment version, hidden grader, staged reward, failed-rollout export, harness labels oracle / NOP / reference / byo. The JSON report schema is EvaluationJsonReportSchema. Cost and tokens stay null unless the worker recorded them. See docs/benchmark/protocol.md.",
    ),
    heading("benchmark-scores", "Scores we do not invent"),
    paragraph(
      "AgentForge Horizon is our private bench protocol: pinned environment version, hidden grader, staged reward, full failed rollouts. This site does not print a Fable 5 percentage and is not a Fable 5 leaderboard. Oracle 1.0 and NOP partial credit are harness contracts, not a public leaderboard.",
    ),
    note(
      "If you run OpenAI or Anthropic agents locally, those rewards belong in your org’s trial rows and optional gitignored score JSON. Do not paste them into marketing copy.",
      "No invented scores",
    ),
  ],
};
