import { heading, numbered, paragraph, type DocsSection } from "../types";

export const GET_STARTED_SECTION: DocsSection = {
  id: "get-started",
  title: "Get started",
  group: "get-started",
  summary:
    "Docs stay public. Runs, artifacts, and trajectories stay in your organization. Create an account, pin a project, and start a pack.",
  blocks: [
    paragraph(
      "Docs stay public. Runs, artifacts, and trajectories stay in your organization. Create an account to receive a personal workspace, then pin a project and start a pack.",
    ),
    numbered([
      "Create an account, then open the workspace.",
      "Add a project if the list is empty. Pack runs pin a project, an immutable environment version, and a harness.",
      "Start the evaluator worker (`python -m evaluator worker --loop`) with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Jobs stay queued until that worker claims them.",
      "Run oracle first — it should reach 1.0 after the worker finishes. Run NOP next — it should not. Example BYO agents under examples/byo-isolated and examples/byo-work score without model keys (AGENTFORGE_BYO_CMD=python /opt/byo/agent.py or AGENTFORGE_BYO_HTTP_URL / stdio). Run the reference agent only when the worker has OPENAI_API_KEY or ANTHROPIC_API_KEY; missing keys fail the job instead of scoring like NOP. BYO is configured on the worker, not in Next.js.",
      "Open Evaluations for catalog runs (Oracle, NOP, reference agent, BYO, or multi-agent). The control plane stores job metadata; the evaluator writes trial metrics.",
      "When scores are poor, export failed and recovery rollouts from Environments (GET /api/v1/rollouts?kind=failed). Each line is a PRIVATE trajectory for that attempt.",
    ]),
    heading("start-where", "Where things live in the app"),
    paragraph(
      "Primary nav: Home, Projects, Evaluations, Environments. Account: Docs, Settings. Shortcuts off the short sidebar: Trials, Results, Protocol, Reviews, Suites, Lab, Benchmarks. Stage scores show up under Environments after evaluation_trials exist. If the list is empty, the worker has not written yet — this page will not invent a number to fill the gap.",
    ),
    heading("start-auth", "API session"),
    paragraph(
      "Environment and rollout routes use the same signed-in session as the workspace. Unauthenticated calls return 401. Organization slugs in the JSON body must match a tenant you can access; lookups are scoped with organization_id. There is no public unauthenticated eval API.",
    ),
  ],
};
