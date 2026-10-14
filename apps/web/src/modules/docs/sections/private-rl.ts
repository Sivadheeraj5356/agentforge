import { bullet, code, heading, note, paragraph, table, type DocsSection } from "../types";

export const PRIVATE_RL_SECTION: DocsSection = {
  id: "private-rl",
  title: "Private RL",
  group: "product",
  summary:
    "Run the same agent many times on the same immutable environment version, inside your organization. Failed attempts keep their logs, trajectories, and PRIVATE export.",
  blocks: [
    paragraph(
      "Private RL means you run the same agent many times on the same immutable environment version, inside your organization. When scores are poor, AgentForge keeps the evidence: trial logs, trajectory artifacts, and rollout export for every failed attempt. Nothing here is a public leaderboard. Privacy class on the export is PRIVATE.",
    ),
    heading("private-rl-repeats", "Repeated rollouts"),
    paragraph(
      "Two knobs exist today. attemptCount (1–8) on the evaluator configuration runs independent trials in one job and stores pass@k. Reset enqueues a new job against the same environment_versions row (new_workspace or new_world). Both paths write evaluation_trials and, when present, rollouts.reward. The control plane does not sample a stream processor; it reads Postgres rows scoped by organization_id.",
    ),
    heading("private-rl-artifacts", "Logs and trajectories"),
    paragraph(
      "For each trial the worker writes trial-{n}-trajectory.json with a truncated log and a trajectory payload (steps: tool, command, observation). That artifact is stored org-scoped and linked as trajectory_artifact_id on the trial. Failed attempts are first-class rows. There is no “only keep the best run” filter in the worker.",
    ),
    code(
      "json",
      `{
  "schemaVersion": 1,
  "log": "opened admin-console … placed ORD-8841",
  "trajectory": "{\\"steps\\":[{\\"step\\":1,\\"tool\\":\\"mcp\\",\\"command\\":\\"initialize\\",\\"observation\\":\\"…\\"}]}"
}`,
      "trial-1-trajectory.json (worker artifact)",
    ),
    heading("private-rl-export", "PRIVATE export"),
    paragraph(
      "GET /api/v1/rollouts requires a session. RLS keeps other orgs’ rollouts out. Query kind is all | successful | failed | recovery | preference (RolloutExportKindSchema). The response is NDJSON, Content-Disposition attachment, privacyClass PRIVATE. Failed means reward is not null and reward < 1. Recovery means 0 < reward < 1. Successful means reward === 1. Preference emits pairs: highest versus lowest scored rollout on the same environment version.",
    ),
    table(
      ["kind", "Filename", "Contents"],
      [
        [
          "all",
          "agentforge-rollouts-all.jsonl",
          "Up to 1000 recent rollouts, ATIF-shaped when trial steps exist",
        ],
        ["successful", "agentforge-rollouts-successful.jsonl", "reward === 1"],
        [
          "failed",
          "agentforge-rollouts-failed.jsonl",
          "Every scored miss, including partial credit",
        ],
        ["recovery", "agentforge-rollouts-recovery.jsonl", "Partial credit only"],
        ["preference", "agentforge-preferences.jsonl", "preferred / rejected ids plus rewards"],
      ],
      "GET /api/v1/rollouts",
    ),
    code(
      "http",
      `GET /api/v1/rollouts?kind=failed

{"schemaVersion":1,"privacyClass":"PRIVATE","format":"atif-shaped","rolloutId":"…","seed":0,"reward":0.15,"evaluationRunId":"…","trajectory":[{"step":1,"tool":"mcp","command":"initialize","observation":"…"}]}`,
      "Failed rollout line",
    ),
    code(
      "http",
      `GET /api/v1/rollouts/{id}

{
  "id": "…",
  "seed": 0,
  "reward": 0.15,
  "environmentVersionId": "…",
  "evaluationRunId": "…",
  "stages": { "stage_inventory": 1, "stage_checkout": 0 }
}`,
      "Single rollout + worker-written stage_* keys",
    ),
    heading("private-rl-workspace", "From the workspace"),
    bullet([
      "Environments → Export lists the same kind URLs (all, successful, failed, recovery, preference).",
      "Capability gap counts real failure_category values from trials. It does not invent a pie chart.",
      "Partial rewards lists stage_* keys only after the worker wrote metrics.",
    ]),
    note(
      "Export is org-scoped JSONL for your training loop. It is not Kafka, not ClickHouse, and not a billable event stream in this slice.",
      "PRIVATE, not a public feed",
    ),
  ],
};
