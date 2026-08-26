import * as React from "react";

import { cn } from "../lib/utils";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps): React.ReactElement {
  return (
    <input
      type={type}
      className={cn(
        "border-border bg-surface text-foreground placeholder:text-muted-foreground h-(--height-control) w-full rounded-md border px-3 text-sm transition-colors",
        "focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
