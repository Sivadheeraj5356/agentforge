"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";

import { Separator } from "@agentforge/ui";

import { DocsArticle } from "./docs-article";
import { DocsSearch } from "./docs-search";
import { adjacentDocsPages, docsNavGroups, docsPageHref } from "./routing";
import { DOCS_NAV_GROUP_LABELS, sectionHeadings, type DocsSection } from "./types";

function currentLinkClass(active: boolean): string {
  return active
    ? "text-foreground border-accent bg-muted/50 border-l-[3px] py-1 pl-3 text-base font-medium"
    : "text-muted-foreground hover:text-foreground border-transparent border-l-[3px] py-1 pl-3 text-base hover:underline";
}

export function DocsShell({
  section,
  basePath,
  workspaceHref,
}: {
  section: DocsSection;
  basePath: string;
  workspaceHref?: string;
}): ReactElement {
  const groups = docsNavGroups();
  const headings = sectionHeadings(section);
  const { prev, next } = adjacentDocsPages(section.id);
  const groupLabel = DOCS_NAV_GROUP_LABELS[section.group];

  const footer: ReactNode = workspaceHref ? (
    <Link href={workspaceHref} className="text-accent text-lg underline-offset-4 hover:underline">
      Back to workspace
    </Link>
  ) : (
    <Link href="/signup" className="text-accent text-lg underline-offset-4 hover:underline">
      Create an account
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <p className="text-muted-foreground font-mono text-base uppercase tracking-[0.16em]">Docs</p>
        <DocsSearch basePath={basePath} />
      </div>

      <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-12">
        <aside className="xl:sticky xl:top-24 xl:w-56 xl:shrink-0">
          <nav aria-label="Docs" className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground font-mono text-sm uppercase tracking-[0.16em]">
                  {group.label}
                </p>
                <ul className="flex flex-row flex-wrap gap-x-3 gap-y-1 xl:flex-col xl:gap-0">
                  {group.sections.map((item) => (
                    <li key={item.id}>
                      <Link href={docsPageHref(basePath, item.id)} className={currentLinkClass(item.id === section.id)}>
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="text-muted-foreground font-mono text-base uppercase tracking-[0.16em]">
              {groupLabel}
            </p>
            <h1 className="font-serif text-5xl font-semibold tracking-tight">{section.title}</h1>
            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">{section.summary}</p>
          </header>
          <DocsArticle section={section} />

          <nav
            aria-label="Adjacent pages"
            className="border-border grid gap-4 border-t pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <Link
                href={docsPageHref(basePath, prev.id)}
                className="border-border hover:bg-muted/40 flex flex-col gap-1 rounded-md border px-4 py-3"
              >
                <span className="text-muted-foreground font-mono text-sm uppercase tracking-[0.14em]">
                  Previous
                </span>
                <span className="text-lg">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={docsPageHref(basePath, next.id)}
                className="border-border hover:bg-muted/40 flex flex-col gap-1 rounded-md border px-4 py-3 sm:text-right"
              >
                <span className="text-muted-foreground font-mono text-sm uppercase tracking-[0.14em]">
                  Next
                </span>
                <span className="text-lg">{next.title}</span>
              </Link>
            ) : null}
          </nav>

          <Separator />
          <p>{footer}</p>
        </div>

        <aside className="hidden xl:sticky xl:top-24 xl:block xl:w-52 xl:shrink-0">
          <nav aria-label="On this page" className="flex flex-col gap-2">
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-[0.16em]">
              On this page
            </p>
            {headings.length === 0 ? (
              <p className="text-muted-foreground text-base">This page is a single topic.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {headings.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="text-muted-foreground hover:text-foreground text-base underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </aside>
      </div>
    </div>
  );
}
