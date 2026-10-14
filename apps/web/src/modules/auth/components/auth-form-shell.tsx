import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

export function AuthFormShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="max-w-88 w-full">
        <div className="mb-8 flex flex-col gap-3">
          <Link
            href="/"
            className="text-muted-foreground font-mono text-xs uppercase tracking-[0.16em]"
          >
            AgentForge
          </Link>
          <h1 className="font-serif text-3xl leading-tight tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </div>
        {children}
        {footer ? <div className="text-muted-foreground mt-6 text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
