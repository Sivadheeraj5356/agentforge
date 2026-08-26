import * as React from "react";

import { cn } from "../lib/utils";

export type LabelProps = React.ComponentProps<"label">;

export function Label({ className, ...props }: LabelProps): React.ReactElement {
  return (
    <label
      className={cn("text-foreground text-sm font-medium leading-none", className)}
      {...props}
    />
  );
}
