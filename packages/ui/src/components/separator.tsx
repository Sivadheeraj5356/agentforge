import * as React from "react";

import { cn } from "../lib/utils";

export type SeparatorProps = React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator({
  className,
  orientation = "horizontal",
  role = "separator",
  ...props
}: SeparatorProps): React.ReactElement {
  return (
    <div
      role={role}
      aria-orientation={orientation}
      className={cn(
        "bg-border shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
