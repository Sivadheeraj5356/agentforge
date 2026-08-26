import type { AppShellNav } from "@agentforge/contracts";
import { AppShellNavSchema } from "@agentforge/contracts";

export function buildAppShellNav(organizationSlug: string): AppShellNav {
  const base = `/app/${organizationSlug}`;
  const rawNav = {
    primary: [
      { id: "home", label: "Home", href: base },
      { id: "projects", label: "Projects", href: `${base}/projects` },
      { id: "evaluations", label: "Evaluations", href: `${base}/evaluations` },
      { id: "environments", label: "Environments", href: `${base}/environments` },
    ],
    secondary: [
      { id: "docs", label: "Docs", href: `${base}/docs` },
      { id: "settings", label: "Settings", href: `${base}/settings` },
    ],
  } as const;

  return AppShellNavSchema.parse(rawNav);
}

export type WorkspaceShortcut = {
  id: string;
  label: string;
  href: string;
  description: string;
};

/** Destinations kept off the primary sidebar so the shell stays short. */
export function workspaceShortcuts(organizationSlug: string): readonly WorkspaceShortcut[] {
  const base = `/app/${organizationSlug}`;
  return [
    {
      id: "benchmarks",
      label: "Benchmarks",
      href: `${base}/benchmarks`,
      description: "Pinned catalog suites for evaluation runs",
    },
    {
      id: "trials",
      label: "Trials",
      href: `${base}/trials`,
      description: "Individual attempts inside a run",
    },
    {
      id: "results",
      label: "Results",
      href: `${base}/results`,
      description: "Aggregated rewards written by the evaluator",
    },
    {
      id: "protocol",
      label: "Protocol",
      href: `${base}/results/protocol`,
      description: "Recorded oracle, NOP, BYO, and reference rows",
    },
    {
      id: "reviews",
      label: "Reviews",
      href: `${base}/reviews`,
      description: "Findings and adjudication",
    },
    {
      id: "suites",
      label: "Suites",
      href: `${base}/suites`,
      description: "Grouped tasks with pass@k gates",
    },
    {
      id: "lab",
      label: "Lab",
      href: `${base}/lab`,
      description: "Scenarios, datasets, and environment versions",
    },
  ];
}

/**
 * Routes that need the full content area rather than the reading-width column.
 * The task inspector is three panes side by side; squeezing it into the same
 * measure as a settings form would leave the file viewer unusable.
 */
export function isFullWidthRoute(pathname: string): boolean {
  return /^\/app\/[^/]+\/projects\/[^/]+\/tasks\/[^/]+/.test(pathname);
}
