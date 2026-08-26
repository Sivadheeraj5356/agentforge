import type { ReactElement } from "react";
import Link from "next/link";

import type { EvaluationRunListItem } from "@/modules/evaluations/server/evaluation-runs";
import {
  classifyFailure,
  modelComparisonFromRuns,
} from "@/modules/evaluations/server/task-evaluations";
import type { TrialView } from "@/modules/evaluations/server/trials";

const SECTIONS = [
  "overview",
  "oracle",
  "nop",
  "agents",
  "trials",
  "verifier",
  "artifacts",
] as const;

type Section = (typeof SECTIONS)[number];

function agentKindOf(run: EvaluationRunListItem): string {
  const config = run.evaluator_configuration;
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return "oracle";
  }
  const kind = (config as { agentKind?: unknown }).agentKind;
  return typeof kind === "string" ? kind : "oracle";
}

function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(4);
}

export function TaskEvaluationDashboard({
  organizationSlug,
  taskBasePath,
  section,
  runs,
  trialsByRunId,
}: {
  organizationSlug: string;
  taskBasePath: string;
  section: string | null;
  runs: readonly EvaluationRunListItem[];
  trialsByRunId: ReadonlyMap<string, readonly TrialView[]>;
}): ReactElement | null {
  if (runs.length === 0) {
    return null;
  }

  const oracleRuns = runs.filter((run) => agentKindOf(run) === "oracle");
  const nopRuns = runs.filter((run) => agentKindOf(run) === "nop");
  const agentRuns = runs.filter((run) => {
    const kind = agentKindOf(run);
    return kind === "agent" || kind === "multi_agent";
  });
  const allTrials = runs.flatMap((run) => [...(trialsByRunId.get(run.id) ?? [])]);
  const visible: Section[] = ["overview"];
  if (oracleRuns.length > 0) visible.push("oracle");
  if (nopRuns.length > 0) visible.push("nop");
  if (agentRuns.length > 0) visible.push("agents");
  if (allTrials.length > 0) visible.push("trials");
  if (nopRuns.length > 0 || oracleRuns.length > 0) visible.push("verifier");
  if (allTrials.some((trial) => trial.trajectory_artifact_id)) visible.push("artifacts");

  const active: Section = visible.includes(section as Section) ? (section as Section) : "overview";
  const comparison = modelComparisonFromRuns(runs, trialsByRunId);

  return (
    <section aria-labelledby="eval-dashboard-heading" className="flex flex-col gap-4">
      <h2 id="eval-dashboard-heading" className="font-serif text-lg tracking-tight">
        Evaluation
      </h2>
      <nav aria-label="Evaluation sections" className="flex flex-wrap gap-2">
        {visible.map((id) => (
          <Link
            key={id}
            href={`${taskBasePath}?section=${id}`}
            className={
              active === id
                ? "bg-accent/10 text-accent rounded-md px-3 py-1 text-sm font-medium"
                : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm"
            }
          >
            {id}
          </Link>
        ))}
        <Link
          href={`${taskBasePath}?section=files`}
          className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm"
        >
          files
        </Link>
      </nav>

      {active === "overview" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Oracle fail ≠ agent fail. NOP pass means the verifier is not intact. Timeouts are
            infrastructure, not model scores. Cost and tokens stay empty until the evaluator records
            them.
          </p>
          {comparison.length > 0 ? (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Model comparison from evaluation_results</caption>
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="py-2 font-medium">Snapshot</th>
                  <th className="py-2 font-medium">Agent</th>
                  <th className="py-2 font-medium">pass@1</th>
                  <th className="py-2 font-medium">mean reward</th>
                  <th className="py-2 font-medium">latency</th>
                  <th className="py-2 font-medium">cost</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={`${row.agentName}-${row.modelSnapshot}`} className="border-b">
                    <td className="py-2 font-mono text-xs">{row.modelSnapshot}</td>
                    <td className="py-2">{row.agentName}</td>
                    <td className="py-2">{formatScore(row.passAt1)}</td>
                    <td className="py-2">{formatScore(row.meanReward)}</td>
                    <td className="py-2">
                      {row.meanLatencyMs === null ? "—" : `${Math.round(row.meanLatencyMs)} ms`}
                    </td>
                    <td className="py-2">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No scores yet. The worker writes pass@k after it grades a trial.
            </p>
          )}
        </div>
      ) : null}

      {active === "oracle" || active === "nop" || active === "agents" ? (
        <ul className="flex flex-col gap-2">
          {(active === "oracle" ? oracleRuns : active === "nop" ? nopRuns : agentRuns).map(
            (run) => {
              const trial = trialsByRunId.get(run.id)?.[0];
              return (
                <li key={run.id} className="border-border rounded-md border px-3 py-2 text-sm">
                  <Link
                    href={`/app/${organizationSlug}/evaluations/${run.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    run {run.run_number}
                  </Link>{" "}
                  · {run.status} · pass@1 {formatScore(run.passAt1)} · {classifyFailure(run, trial)}
                </li>
              );
            },
          )}
        </ul>
      ) : null}

      {active === "trials" ? (
        <ul className="flex flex-col gap-2">
          {runs.map((run) =>
            (trialsByRunId.get(run.id) ?? []).map((trial) => (
              <li key={trial.id} className="border-border rounded-md border px-3 py-2 text-sm">
                run {run.run_number} attempt {trial.attempt_index} · reward{" "}
                {formatScore(trial.reward === null ? null : Number(trial.reward))} ·{" "}
                {classifyFailure(run, trial)}
              </li>
            )),
          )}
        </ul>
      ) : null}

      {active === "verifier" ? (
        <p className="text-sm leading-relaxed">
          Verifier integrity is inferred from NOP and Oracle rows only. A NOP pass is a broken
          grader. An Oracle fail is not evidence that an agent failed.
        </p>
      ) : null}

      {active === "artifacts" ? (
        <ul className="flex flex-col gap-2 text-sm">
          {allTrials
            .filter((trial) => trial.trajectory_artifact_id)
            .map((trial) => (
              <li key={trial.id} className="font-mono text-xs">
                trajectory {trial.trajectory_artifact_id}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
