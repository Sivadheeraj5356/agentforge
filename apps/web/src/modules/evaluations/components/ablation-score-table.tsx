import type { ReactElement } from "react";

import type { AblationGroup } from "@/modules/evaluations/server/ablation";

function formatScore(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(4);
}

export function AblationScoreTable({
  groups,
}: {
  groups: readonly AblationGroup[];
}): ReactElement | null {
  if (groups.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="ablation-heading" className="flex flex-col gap-4">
      <h2 id="ablation-heading" className="font-serif text-lg tracking-tight">
        Reward ablations
      </h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Binary vs continuous vs hybrid on the same pinned task versions. Cells stay empty until the
        evaluator worker writes scores.
      </p>
      {groups.map((group) => (
        <table key={group.ablationId} className="w-full text-left text-sm">
          <caption className="text-muted-foreground mb-2 font-mono text-xs">
            ablation {group.ablationId.slice(0, 8)}
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th className="py-2 pr-4 font-medium">Recipe</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Mean reward</th>
              <th className="py-2 font-medium">pass@1</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.runId} className="border-border border-b">
                <td className="py-2 pr-4 font-mono text-xs">{row.recipe}</td>
                <td className="py-2 pr-4 text-sm">{row.status}</td>
                <td className="py-2 pr-4 font-mono text-xs">{formatScore(row.meanReward)}</td>
                <td className="py-2 font-mono text-xs">{formatScore(row.passAt1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}
