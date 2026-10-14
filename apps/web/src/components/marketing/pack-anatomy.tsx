"use client";

import type { ReactElement } from "react";
import {
  EXPERIENCE_PACK_CATALOG,
  simulatedLabel,
  type ExperiencePack,
} from "@agentforge/contracts";
import { easeOut, motion, useReducedMotion } from "@/components/marketing/motion";

const FEATURED_PACK_KEY = "production-incident-eu-payments";

function packByKey(key: string): ExperiencePack | undefined {
  return EXPERIENCE_PACK_CATALOG.find((item) => item.key === key);
}

function resetLabel(kind: ExperiencePack["reset"]["kind"]): string {
  return kind.replace(/_/g, " ");
}

function familyLabel(family: ExperiencePack["family"]): string {
  return family.replace(/-/g, " ");
}

export function PackAnatomy({
  packKey = FEATURED_PACK_KEY,
}: {
  packKey?: string;
} = {}): ReactElement | null {
  const reduce = useReducedMotion();
  const pack = packByKey(packKey) ?? packByKey(FEATURED_PACK_KEY) ?? EXPERIENCE_PACK_CATALOG[0];

  if (!pack) {
    return null;
  }

  return (
    <aside
      aria-label={`${pack.title} pack anatomy`}
      className="border-border bg-surface border-l-accent overflow-hidden rounded-lg border border-l-[3px] shadow-md"
    >
      <div className="border-border flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Experience pack</p>
        <p className="text-muted-foreground font-mono text-xs">
          {pack.key} · v{pack.version}
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div>
          <p className="font-serif text-lg tracking-tight">{pack.title}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{pack.instruction}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.12em]">
            Reward
          </dt>
          <dd>Staged · weights sum to 1</dd>
          <dt className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.12em]">
            Reset
          </dt>
          <dd className="font-mono text-xs">{resetLabel(pack.reset.kind)}</dd>
          <dt className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.12em]">
            World
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {pack.simulated.map((backend) => (
              <span
                key={backend}
                className="border-border bg-muted/60 rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
              >
                {simulatedLabel(backend)}
              </span>
            ))}
          </dd>
        </dl>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.12em]">
            Hidden stage verifiers
          </p>
          <ul className="flex flex-col gap-2">
            {pack.stages.map((stage, index) => (
              <li key={stage.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{stage.label}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                    {stage.weight.toFixed(2)}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                  <motion.div
                    className="bg-accent h-full origin-left rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: reduce ? 0 : 0.65,
                      delay: reduce ? 0 : 0.12 * index,
                      ease: easeOut,
                    }}
                    style={{ width: `${Math.round(stage.weight * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Weights only. Scores appear after the evaluator writes trial metrics.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function PackCatalog(): ReactElement {
  return (
    <ul
      aria-label="Shipped packs"
      className="border-border divide-border divide-y rounded-lg border"
    >
      {EXPERIENCE_PACK_CATALOG.map((pack) => (
        <li key={pack.key} className="bg-surface flex flex-col gap-3 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.14em]">
              {familyLabel(pack.family)}
            </p>
            <p className="text-muted-foreground font-mono text-xs">
              {pack.key} · {resetLabel(pack.reset.kind)}
            </p>
          </div>
          <p className="font-serif text-xl tracking-tight">{pack.title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{pack.instruction}</p>
          <div className="flex flex-wrap gap-1.5">
            {pack.simulated.map((backend) => (
              <span
                key={backend}
                className="border-border bg-muted/60 rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
              >
                {simulatedLabel(backend)}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
