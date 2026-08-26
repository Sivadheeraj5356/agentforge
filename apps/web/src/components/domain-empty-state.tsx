import type { ReactElement } from "react";

export function DomainEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactElement {
  return (
    <div className="border-border bg-surface flex flex-col gap-1.5 rounded-lg border border-dashed px-6 py-10">
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">{description}</p>
    </div>
  );
}
