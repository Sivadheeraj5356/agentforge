import type { ReactElement } from "react";

import type { TrialStep } from "@/modules/evaluations/server/trials";

export function TrajectoryViewer({ steps }: { steps: readonly TrialStep[] }): ReactElement {
  if (steps.length === 0) {
    return <p className="text-muted-foreground mt-2 text-xs">No trajectory steps recorded.</p>;
  }
  return (
    <ol className="border-border mt-3 divide-y rounded-md border">
      {steps.map((step) => (
        <li key={`${step.step}-${step.tool}`} className="flex flex-col gap-1 px-3 py-2">
          <p className="font-mono text-xs">
            {step.step}. {step.tool}
          </p>
          <p className="text-muted-foreground font-mono text-xs">{step.command}</p>
          <p className="whitespace-pre-wrap text-sm">{step.observation}</p>
        </li>
      ))}
    </ol>
  );
}
