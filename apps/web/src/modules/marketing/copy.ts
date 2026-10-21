export const LANDING_HEADLINE = "Know if the agent actually fixed it.";

export const LANDING_SUBHEAD =
  "Private work environments with hidden stage verifiers. You queue the trial. The evaluator writes the score.";

export const LANDING_BADGE = "Now shipping: private work environments";

export const LANDING_PROOF = [
  { label: "Hidden verifiers", detail: "Stages the agent cannot see" },
  { label: "Staged reward", detail: "Weights sum to 1" },
  { label: "Trusted control plane", detail: "Untrusted code runs outside the web app" },
] as const;

export const LANDING_PROVIDE_EYEBROW = "Evaluation infrastructure";

export const LANDING_PROVIDE_HEADING = "What AgentForge provides.";

export const LANDING_PROVIDE_LEAD =
  "Executable packs you can grade: instruction, world, tools, hidden stage verifiers, staged reward, and a reset. The workspace queues the trial. The evaluator writes the score.";

export const LANDING_PROVIDE = [
  {
    title: "Private work environments",
    body: "Worlds the agent can fail in — simulated tools, labeled simulated, with a reset you can run again.",
  },
  {
    title: "Staged rewards",
    body: "Each stage has a weight. Partial credit is a sum you can show, not a pass/fail story.",
  },
  {
    title: "Hidden verifiers",
    body: "Graders sit off the agent filesystem. A fluent write-up can still fail the stage it never saw.",
  },
  {
    title: "Catalog evaluations",
    body: "Pin a shipped pack and read stage scores after the run. Families today: Orders API operations, EU payments incident, Checkout console clone, and Private eval — stalled release train.",
  },
  {
    title: "Org-scoped workspace",
    body: "Trials, packs, and scores stay inside your organization. Queue a run from the app; the evaluator records the result.",
  },
  {
    title: "Public Docs",
    body: "How packs, runs, and the control/execution split work. No account required to read them.",
  },
] as const;

export const LANDING_PROBLEM = {
  title: "Chat can sound right and still be wrong.",
  body: "An agent will narrate a rollback, skip the customer rows, and call it done. AgentForge scores the work in a world that can fail — hidden stages, a staged reward, a reset.",
} as const;

export const LANDING_PACK_EYEBROW = "Shipped packs";

export const LANDING_PACK_HEADING = "A world the agent can fail in.";

export const LANDING_PACK_LEAD =
  "Four families on the catalog: Orders API operations, an EU payments incident with Simulated Slack, GitHub, Jira, and Grafana, a Checkout console clone across Simulated checkout UI, admin console, and support inbox, and a private long-horizon eval (stalled release train) across Simulated ops console, runbook, and handoff board. Each pack is instruction, world, tools, hidden stage weights, staged reward, and a reset. The evaluator writes the numbers. This page does not.";

export const LANDING_RUN_EYEBROW = "A scored trial";

export const LANDING_RUN_HEADING = "How a run works";

export const LANDING_RUN_PATH = [
  { label: "Enqueue", detail: "Pin a pack or catalog task in the workspace." },
  { label: "Evaluate", detail: "The worker starts the world and hidden verifiers." },
  { label: "Record", detail: "Stage scores, reward, and trajectory land on the trial." },
] as const;

export const LANDING_BENEFITS_EYEBROW = "A score you can defend";

export const LANDING_BENEFITS_HEADING = "Why the score holds up";

export const LANDING_BENEFITS = [
  {
    title: "Catch the silent miss",
    body: "Hidden graders sit off the agent filesystem. A fluent write-up can still fail the stage it never saw.",
  },
  {
    title: "Defend the score",
    body: "Each stage has a weight. Partial credit is a sum you can show, not a pass/fail story.",
  },
  {
    title: "Keep the app trusted",
    body: "The web app orchestrates. Sandboxes and graders run in the evaluator — never in the browser.",
  },
] as const;

export const LANDING_AUDIENCE_EYEBROW = "Who this is for";

export const LANDING_AUDIENCE_HEADING = "Who it's for.";

export const LANDING_AUDIENCE_LEAD =
  "Labs and agent teams who cannot treat a chat trace as evidence.";

export const LANDING_AUDIENCE = [
  {
    title: "Labs",
    body: "When a fluent transcript is not a result. You need a world that can fail, hidden stages, and a score you can defend.",
  },
  {
    title: "Agent teams",
    body: "When the agent claims it rolled back payments or patched orders, you need the evaluator — not the chat — to say whether it did.",
  },
] as const;

export const LANDING_FINAL_HEADING = "Grade the work, not the chat.";

export const LANDING_FINAL_LEAD =
  "Create a workspace, start a pack, and read the score the evaluator wrote.";

export function marketingPlainText(): string {
  return [
    LANDING_HEADLINE,
    LANDING_SUBHEAD,
    LANDING_BADGE,
    ...LANDING_PROOF.flatMap((item) => [item.label, item.detail]),
    LANDING_PROVIDE_EYEBROW,
    LANDING_PROVIDE_HEADING,
    LANDING_PROVIDE_LEAD,
    ...LANDING_PROVIDE.flatMap((item) => [item.title, item.body]),
    LANDING_PROBLEM.title,
    LANDING_PROBLEM.body,
    LANDING_PACK_EYEBROW,
    LANDING_PACK_HEADING,
    LANDING_PACK_LEAD,
    LANDING_RUN_EYEBROW,
    LANDING_RUN_HEADING,
    ...LANDING_RUN_PATH.flatMap((item) => [item.label, item.detail]),
    LANDING_BENEFITS_EYEBROW,
    LANDING_BENEFITS_HEADING,
    ...LANDING_BENEFITS.flatMap((item) => [item.title, item.body]),
    LANDING_AUDIENCE_EYEBROW,
    LANDING_AUDIENCE_HEADING,
    LANDING_AUDIENCE_LEAD,
    ...LANDING_AUDIENCE.flatMap((item) => [item.title, item.body]),
    LANDING_FINAL_HEADING,
    LANDING_FINAL_LEAD,
  ].join("\n");
}
