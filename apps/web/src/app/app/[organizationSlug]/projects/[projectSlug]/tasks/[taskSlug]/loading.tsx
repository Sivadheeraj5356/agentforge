import type { ReactElement } from "react";

/** Restrained skeleton: the shape of the inspector, not a shimmering imitation of it. */
export default function TaskInspectorLoading(): ReactElement {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Loading task</span>

      <div className="border-border flex flex-col gap-4 border-b pb-4">
        <div className="bg-muted h-3 w-64 rounded-sm" />
        <div className="bg-muted h-7 w-80 rounded-sm" />
        <div className="flex flex-wrap gap-8">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="bg-muted h-2 w-16 rounded-sm" />
              <div className="bg-muted h-3 w-24 rounded-sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="border-border flex h-[calc(100dvh-17rem)] min-h-[32rem] rounded-md border">
        <div className="border-border w-60 shrink-0 border-e p-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="bg-muted mb-2 h-3 rounded-sm"
              style={{ width: `${50 + ((index * 17) % 40)}%` }}
            />
          ))}
        </div>
        <div className="border-border flex-1 border-e p-3">
          {Array.from({ length: 14 }, (_, index) => (
            <div
              key={index}
              className="bg-muted mb-2 h-3 rounded-sm"
              style={{ width: `${35 + ((index * 23) % 55)}%` }}
            />
          ))}
        </div>
        <div className="w-80 shrink-0 p-3 lg:w-96">
          <div className="bg-muted mb-4 h-3 w-24 rounded-sm" />
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="mb-4 flex flex-col gap-1.5">
              <div className="bg-muted h-2.5 w-20 rounded-sm" />
              <div className="bg-muted h-3 w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
