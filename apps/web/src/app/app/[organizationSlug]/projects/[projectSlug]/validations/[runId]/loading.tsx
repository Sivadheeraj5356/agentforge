import type { ReactElement } from "react";

export default function ValidationRunLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.14em]">
          validation
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Validation report</h1>
      </header>
      <p role="status" className="text-muted-foreground text-sm">
        Inspecting task package…
      </p>
    </div>
  );
}
