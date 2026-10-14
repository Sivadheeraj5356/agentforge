"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@agentforge/ui";

import { ThemeToggle } from "@/components/theme-toggle";

const headerLinkClass =
  "text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline";

const primaryCtaClass =
  "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-full text-sm font-medium touch-manipulation";

const outlineCtaClass =
  "border-border bg-surface/80 text-foreground hover:bg-muted inline-flex items-center justify-center rounded-full border text-sm font-medium touch-manipulation backdrop-blur-sm";

const sizeClass = {
  md: "h-(--height-control) px-3.5",
  lg: "min-h-11 h-11 px-5",
} as const;

export function SiteChrome({
  children,
  signedIn,
}: {
  children: ReactNode;
  signedIn: boolean;
}): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col" suppressHydrationWarning>
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-border bg-background/70 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="px-(--spacing-page) mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-foreground font-mono text-lg font-medium tracking-tight sm:text-xl"
          >
            AgentForge
          </Link>
          <nav aria-label="Site" className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            <Link href="/docs" className={headerLinkClass}>
              Docs
            </Link>
            <ThemeToggle className="w-36 shrink-0 sm:w-40" />
            {signedIn ? (
              <Link href="/app" className={cn(primaryCtaClass, sizeClass.md)}>
                Open workspace
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(headerLinkClass, "hidden sm:inline")}>
                  Sign in
                </Link>
                <Link href="/signup" className={cn(primaryCtaClass, sizeClass.md)}>
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-border border-t">
        <div className="text-muted-foreground px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 py-6 text-sm">
          <p className="font-mono text-xs tracking-tight">AgentForge</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/docs" className={headerLinkClass}>
              Docs
            </Link>
            <Link href={signedIn ? "/app" : "/login"} className={headerLinkClass}>
              {signedIn ? "Workspace" : "Sign in"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MarketingCtaLink({
  href,
  children,
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline";
  size?: "md" | "lg";
}): ReactElement {
  return (
    <Link
      href={href}
      className={cn(variant === "primary" ? primaryCtaClass : outlineCtaClass, sizeClass[size])}
    >
      {children}
    </Link>
  );
}
