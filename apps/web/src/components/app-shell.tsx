"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, Separator } from "@agentforge/ui";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { buildAppShellNav, isFullWidthRoute } from "@/lib/navigation";
import { WorkspaceSwitcher } from "@/modules/organizations/components/workspace-switcher";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}): ReactElement {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-(--height-nav-item) flex items-center rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-accent/10 text-accent font-medium"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  children,
  organizationSlug,
  organizations,
  userEmail,
}: Readonly<{
  children: ReactNode;
  organizationSlug: string;
  organizations: Array<{ id: string; name: string; slug: string }>;
  userEmail: string | undefined;
}>): ReactElement {
  const pathname = usePathname();
  const nav = buildAppShellNav(organizationSlug);
  const homeHref = `/app/${organizationSlug}`;

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border bg-surface flex w-56 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center px-4">
          <Link
            href={homeHref}
            className="text-foreground font-mono text-sm font-medium tracking-tight"
          >
            AgentForge
          </Link>
        </div>
        <Separator />
        <div className="flex flex-1 flex-col gap-6 p-3">
          <nav aria-label="Primary">
            <ul className="flex flex-col gap-0.5">
              {nav.primary.map((item) => {
                const active =
                  item.href === homeHref ? pathname === homeHref : pathname.startsWith(item.href);
                return (
                  <li key={item.id}>
                    <NavLink href={item.href} label={item.label} active={active} />
                  </li>
                );
              })}
            </ul>
          </nav>
          <nav aria-label="Account" className="flex flex-col gap-0.5">
            <p className="text-muted-foreground px-2.5 pb-1 font-mono text-[10px] uppercase tracking-[0.14em]">
              Account
            </p>
            <ul className="flex flex-col gap-0.5">
              {nav.secondary.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.id}>
                    <NavLink href={item.href} label={item.label} active={active} />
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <WorkspaceSwitcher organizations={organizations} activeSlug={organizationSlug} />
            <ThemeToggle />
            <UserMenu email={userEmail} />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={cn(
            "px-(--spacing-page) mx-auto w-full flex-1 py-8",
            isFullWidthRoute(pathname) ? "max-w-none" : "max-w-(--content-width)",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
