import Link from "next/link";
import type { ReactElement } from "react";

export default function NotFound(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
      <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.16em]">404</p>
      <h1 className="font-serif text-3xl tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        This page is unavailable. If you followed a workspace link, you may not have access.
      </p>
      <Link href="/app" className="text-accent text-sm hover:underline">
        Back to app
      </Link>
    </div>
  );
}
