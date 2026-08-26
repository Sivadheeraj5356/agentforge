import {
  bullet,
  code,
  diagram,
  heading,
  paragraph,
  table,
  type DocsSection,
} from "../types";

export const ENVIRONMENTS_SECTION: DocsSection = {
  id: "environments",
  title: "RL environments",
  group: "product",
  summary:
    "A work environment is an executable pack. The control plane lists catalog metadata. The evaluator loads the same JSON. Next.js never executes the pack.",
  blocks: [
    paragraph(
      "A work environment is an executable pack. The control plane lists catalog metadata from @agentforge/contracts (EXPERIENCE_PACK_CATALOG). The evaluator loads the same JSON from environments/packs/. Next.js never executes the pack.",
    ),
    heading("environments-anatomy", "Pack anatomy"),
    paragraph(
      "ExperiencePackSchema (Zod) is the trust-boundary contract. schemaVersion is 1. key is kebab-case. version is pinned and must not be “latest”. Once a version is published, you create a new version instead of mutating the row.",
    ),
    table(
      ["Field", "Meaning"],
      [
        ["family", "orders-ops, production-incident, app-clone, private-eval, horizon-swe, evolving-spec, skill-follow"],
        ["instruction", "What the agent is asked to do"],
        ["simulated", "Backends the agent may reach, always labeled simulated"],
        ["tools", "MCP tool manifest (work sandbox) or terminal-only (Isolated)"],
        ["stages", "Hidden verifiers; weights sum to 1 (±1e-9)"],
        ["rewardRecipe", "staged for these packs"],
        ["catalogTaskKey", "Pinned catalog task the run foreign key points at"],
        ["failureModes", "Honest failure tags, not invented percents"],
        ["reset.kind", "new_workspace (Isolated) or new_world (in-memory world)"],
        ["sandboxProvider", "isolated or work — selected by the worker, not the browser"],
        ["hiddenState", "Evaluator-only. Not mounted on the agent filesystem"],
      ],
      "ExperiencePackSchema fields",
    ),
    heading("environments-families", "Shipped families"),
    table(
      ["Family", "Pack", "Sandbox", "Reset", "World"],
      [
        [
          "orders-ops",
          "Orders API operations",
          "isolated",
          "new_workspace",
          "FastAPI + SQL fixtures with read-only /workspace/context",
        ],
        [
          "production-incident",
          "EU payments / US warehouse",
          "work",
          "new_world",
          "Simulated Slack, GitHub, Jira, Grafana, plus a customer table",
        ],
        [
          "app-clone",
          "Checkout console / support desk",
          "work",
          "new_world",
          "Simulated checkout UI, admin console, support inbox, returns desk; Simulated ticket queue, macro panel, SLA board",
        ],
        [
          "private-eval",
          "Private eval — stalled release train",
          "work",
          "new_world",
          "Simulated ops console, runbook, and handoff board across three operator sessions",
        ],
      ],
      "Catalog families",
    ),
    heading("environments-json", "Pack JSON"),
    paragraph(
      "Sale manifests live under environments/packs/. The snippet below is the staged rubric for Orders API operations — the same object the catalog parses.",
    ),
    code(
      "json",
      `{
  "key": "orders-ops",
  "version": "1.0.0",
  "family": "orders-ops",
  "rewardRecipe": "staged",
  "sandboxProvider": "isolated",
  "reset": { "kind": "new_workspace" },
  "stages": [
    { "id": "investigate", "label": "Service responds after investigation", "weight": 0.2, "metricKey": "service_health" },
    { "id": "patch", "label": "Critical order behavior repaired", "weight": 0.45, "metricKey": "critical_tests" },
    { "id": "contract", "label": "Public API contract held", "weight": 0.15, "metricKey": "api_contract" },
    { "id": "safety", "label": "Grader and hidden tests intact", "weight": 0.2, "metricKey": "diff_quality" }
  ]
}`,
      "environments/packs/orders-ops.json",
    ),
    heading("environments-start", "Start and reset"),
    paragraph(
      "Start and reset go through the Environments workspace and the environment API. Both routes require a signed-in session (401 otherwise). The body is validated with StartEnvironmentInputSchema / ResetEnvironmentInputSchema. The handler enqueues an evaluation; it does not run the world.",
    ),
    code(
      "http",
      `POST /api/v1/environments/start
Content-Type: application/json

{
  "organizationSlug": "acme",
  "projectSlug": "demo",
  "packKey": "checkout-console-clone",
  "agentKind": "oracle"
}

HTTP 201
{
  "evaluationRunId": "…",
  "environmentVersionId": "…"
}`,
      "Start a pack",
    ),
    paragraph(
      "agentKind is oracle | nop | agent | multi_agent (default oracle). Reset posts to the environment version id and re-enqueues against the same immutable spec. Isolated resets by creating a new workspace; incident and app-clone resets by seeding a new in-memory world.",
    ),
    code(
      "http",
      `POST /api/v1/environments/{environmentVersionId}/reset
Content-Type: application/json

{
  "organizationSlug": "acme",
  "projectSlug": "demo",
  "agentKind": "oracle"
}`,
      "Reset an environment version",
    ),
    heading("environments-labels", "Simulated backends"),
    paragraph(
      "Every backend in pack.simulated is labeled in the UI via simulatedLabel(). Copy says Simulated Slack, Simulated checkout UI, and so on. Tools mutate in-world state only. There are no live provider tokens in apps/web.",
    ),
    bullet([
      "slack, github, jira, grafana — incident family, MCP tools in the evaluator",
      "terminal, orders-api — Isolated orders-ops family",
      "checkout-ui, admin-console, support-inbox, returns-desk — checkout clone",
      "ticket-queue, macro-panel, sla-board — support-desk clone",
      "ops-console, runbook, handoff-board — private-eval family",
    ]),
    diagram(
      [
        "Environments UI  →  POST /api/v1/environments/start",
        "                         │",
        "                         ├─ Zod: StartEnvironmentInputSchema",
        "                         ├─ org + project lookup (tenant scoped)",
        "                         └─ enqueue_evaluation RPC",
        "                                  │",
        "                                  ▼",
        "                         evaluator worker claims job",
        "                         load environments/packs/{key}.json",
        "                         Isolated | work world",
        "                         hidden verifiers → trial.metrics",
      ],
      "Start path",
    ),
  ],
};
