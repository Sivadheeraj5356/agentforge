"use client";

import type { ReactElement } from "react";
import { Button } from "@agentforge/ui";

/**
 * A report that cannot be assembled is an operational failure, not the reviewer's
 * mistake. Say what is broken and what still works — never a stack trace, and
 * never "something went wrong".
 */
export default function TaskInspectorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  return (
    <div role="alert" className="flex max-w-prose flex-col items-start gap-3 py-10">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">
        This report could not be assembled
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        The task and its validation history are stored and unchanged. AgentForge could not read one
        of the pieces it needs to show them — usually the run&rsquo;s findings or its file list.
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Try again. If it keeps failing, share the reference below so an operator can find the log
        entry.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs">
          <span className="text-muted-foreground">Reference </span>
          {error.digest}
        </p>
      ) : null}
      <Button type="button" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
