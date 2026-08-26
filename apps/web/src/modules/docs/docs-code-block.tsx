"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@agentforge/ui";

export function DocsCodeBlock({
  language,
  code,
  filename,
}: {
  language: string;
  code: string;
  filename?: string;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  const label = filename ?? language;

  async function copySnippet(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="border-border bg-muted/40 overflow-hidden rounded-md border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-3 py-1.5">
        <p className="text-muted-foreground font-mono text-sm tracking-tight">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void copySnippet();
          }}
          aria-label={`Copy ${label} snippet`}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-base leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}
