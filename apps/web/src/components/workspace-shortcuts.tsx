import type { ReactElement } from "react";
import Link from "next/link";

import { workspaceShortcuts } from "@/lib/navigation";

export function WorkspaceShortcutLinks({
  organizationSlug,
  ids,
}: {
  organizationSlug: string;
  ids?: readonly string[];
}): ReactElement {
  const items = workspaceShortcuts(organizationSlug).filter(
    (item) => ids === undefined || ids.includes(item.id),
  );

  return (
    <nav aria-label="More in this workspace">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function WorkspaceShortcutCards({
  organizationSlug,
}: {
  organizationSlug: string;
}): ReactElement {
  const items = workspaceShortcuts(organizationSlug);

  return (
    <section aria-labelledby="more-heading" className="flex flex-col gap-3">
      <h2 id="more-heading" className="font-serif text-lg tracking-tight">
        More in this workspace
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="border-border hover:bg-muted/50 flex flex-col gap-1 rounded-md border px-3 py-3 transition-colors"
            >
              <span className="font-medium tracking-tight">{item.label}</span>
              <span className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
