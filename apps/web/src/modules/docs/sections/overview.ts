import { bullet, heading, note, paragraph, table, type DocsSection } from "../types";

export const OVERVIEW_SECTION: DocsSection = {
  id: "overview",
  title: "Overview",
  group: "get-started",
  summary:
    "Evaluation infrastructure for agents that have to act in a world. You pin work environments, queue trials, and read rewards the evaluator worker writes.",
  blocks: [
    paragraph(
      "AgentForge is evaluation infrastructure for AI agents that have to act in a world, not only answer a prompt. You pin work environments, queue trials, and read rewards that the evaluator worker writes. The public site is the product: these docs, sign-in, and the workspace. Workspace data stays behind your account. /docs is public so anyone can read how the system works.",
    ),
    paragraph(
      "The unit of work is an experience pack: an instruction, a world, tools, hidden stage verifiers, a staged reward, trajectories, and a reset. Packs are private to your organization. Versions are immutable once published. A change ships as a new version, not an edit in place.",
    ),
    heading("overview-planes", "Two planes"),
    paragraph(
      "The trusted web app is the control plane. It authenticates, stores org-scoped metadata, validates payloads, and enqueues jobs. Its server routes can launch a separate disposable Vercel Sandbox microVM. MCP, Harbor, Docker, untrusted code, and reward computation stay outside the Next.js process. The evaluator service is the execution plane. It claims the job, runs the world, grades with hidden verifiers, and writes trial metrics, logs, and trajectory artifacts.",
    ),
    table(
      ["Plane", "Lives in", "Does"],
      [
        [
          "Control",
          "apps/web and shared TypeScript packages",
          "Auth, tenancy, queue metadata, display records",
        ],
        [
          "Execution",
          "services/evaluator",
          "Worlds, tools, hidden graders, staged reward, trajectories",
        ],
      ],
      "Control plane versus execution plane",
    ),
    heading("overview-public", "What is public"),
    bullet([
      "These docs, the marketing site, and account screens — no sign-in required to read /docs.",
      "Runs, artifacts, trajectories, and pack scores — org-scoped. They appear after you create an account and the evaluator worker writes them.",
      "Simulated backends — always labeled simulated in pack metadata and in the workspace. There is no live Slack, GitHub, Jira, Grafana, or checkout-provider OAuth from this app.",
    ]),
    note(
      "Numbers you see in the workspace are records the worker already wrote. The browser does not grade the agent, and this page does not invent a live leaderboard.",
      "Scores are records",
    ),
  ],
};
