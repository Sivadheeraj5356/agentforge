import { NextResponse } from "next/server";
import { RolloutExportKindSchema } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";
import {
  filterRollouts,
  preferencePairs,
  type ScoredRollout,
} from "@/modules/environments/server/packs";

type TrajectoryStep = {
  readonly step?: unknown;
  readonly tool?: unknown;
  readonly command?: unknown;
  readonly observation?: unknown;
};

function atifLine(
  row: {
    id: string;
    seed: number;
    reward: number | null;
    evaluation_run_id: string | null;
  },
  metrics: unknown,
): string {
  const record =
    typeof metrics === "object" && metrics !== null && !Array.isArray(metrics)
      ? (metrics as { steps?: unknown })
      : {};
  const steps = Array.isArray(record.steps)
    ? record.steps
        .map((item: unknown) => {
          if (typeof item !== "object" || item === null) {
            return null;
          }
          const step = item as TrajectoryStep;
          if (
            typeof step.step !== "number" ||
            typeof step.tool !== "string" ||
            typeof step.command !== "string"
          ) {
            return null;
          }
          return {
            step: step.step,
            tool: step.tool,
            command: step.command,
            observation: typeof step.observation === "string" ? step.observation : "",
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];
  return JSON.stringify({
    schemaVersion: 1,
    privacyClass: "PRIVATE",
    format: steps.length > 0 ? "atif-shaped" : "jsonl",
    rolloutId: row.id,
    seed: row.seed,
    reward: row.reward,
    evaluationRunId: row.evaluation_run_id,
    trajectory: steps,
  });
}

export async function GET(request: Request): Promise<Response> {
  assertNeverExecutesUserCode("api v1 rollouts export");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const url = new URL(request.url);
  const kindParsed = RolloutExportKindSchema.safeParse(url.searchParams.get("kind") ?? "all");
  const kind = kindParsed.success ? kindParsed.data : "all";
  const { data, error } = await session.supabase
    .from("rollouts")
    .select("id, seed, reward, evaluation_run_id, environment_version_id")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    return NextResponse.json({ error: "Unable to export rollouts" }, { status: 400 });
  }
  const scored: ScoredRollout[] = (data ?? []).map((row) => ({
    id: row.id,
    seed: row.seed,
    reward: row.reward,
    environmentVersionId: row.environment_version_id,
    evaluationRunId: row.evaluation_run_id,
  }));
  const runIds = [
    ...new Set(
      scored.map((row) => row.evaluationRunId).filter((id): id is string => typeof id === "string"),
    ),
  ];
  const trialsByRun = new Map<string, unknown>();
  if (runIds.length > 0) {
    const { data: trials } = await session.supabase
      .from("evaluation_trials")
      .select("evaluation_run_id, metrics")
      .in("evaluation_run_id", runIds)
      .order("attempt_index", { ascending: true });
    for (const trial of trials ?? []) {
      if (!trialsByRun.has(trial.evaluation_run_id)) {
        trialsByRun.set(trial.evaluation_run_id, trial.metrics);
      }
    }
  }
  const filename =
    kind === "preference" ? "agentforge-preferences.jsonl" : `agentforge-rollouts-${kind}.jsonl`;
  if (kind === "preference") {
    const pairs = preferencePairs(scored);
    const lines = pairs
      .map((pair) =>
        JSON.stringify({
          schemaVersion: 1,
          privacyClass: "PRIVATE",
          preferred: pair.preferred.id,
          rejected: pair.rejected.id,
          preferredReward: pair.preferred.reward,
          rejectedReward: pair.rejected.reward,
          environmentVersionId: pair.preferred.environmentVersionId,
        }),
      )
      .join("\n");
    return new NextResponse(lines.length > 0 ? `${lines}\n` : "", {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const filtered = filterRollouts(scored, kind);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const lines = filtered
    .map((row) => {
      const original = byId.get(row.id);
      if (!original) {
        return "";
      }
      return atifLine(
        original,
        original.evaluation_run_id ? trialsByRun.get(original.evaluation_run_id) : undefined,
      );
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return new NextResponse(lines.length > 0 ? `${lines}\n` : "", {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
