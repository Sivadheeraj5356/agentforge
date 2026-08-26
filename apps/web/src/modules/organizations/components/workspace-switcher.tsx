"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactElement } from "react";

import { cn } from "@agentforge/ui";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

export function WorkspaceSwitcher({
  organizations,
  activeSlug,
}: {
  organizations: WorkspaceOption[];
  activeSlug: string;
}): ReactElement {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground px-1 font-mono text-[10px] uppercase tracking-[0.14em]">
        Organization
      </p>
      <ul className="flex flex-col gap-0.5">
        {organizations.map((org) => {
          const href = pathname.replace(/^\/app\/[^/]+/, `/app/${org.slug}`) || `/app/${org.slug}`;
          const target =
            pathname.startsWith(`/app/${activeSlug}`) && pathname !== `/app/${activeSlug}`
              ? href
              : `/app/${org.slug}`;
          const active = org.slug === activeSlug;
          return (
            <li key={org.id}>
              <Link
                href={target}
                className={cn(
                  "flex h-8 items-center truncate rounded-md px-2 text-sm transition-colors",
                  active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {org.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
