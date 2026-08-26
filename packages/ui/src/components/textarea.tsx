import * as React from "react";

import { cn } from "../lib/utils";

export type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps): React.ReactElement {
  return (
    <textarea
      className={cn(
        "border-border bg-surface text-foreground placeholder:text-muted-foreground min-h-24 w-full rounded-md border px-3 py-2 text-sm transition-colors",
        "focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
