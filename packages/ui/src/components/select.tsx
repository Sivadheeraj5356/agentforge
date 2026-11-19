"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import * as React from "react";

import { cn } from "../lib/utils";

function ChevronDown({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      className={cn("size-3 shrink-0 opacity-60", className)}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMark({ className }: { className?: string }): React.ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" fill="none" className={cn("size-3.5", className)}>
      <path
        d="m2.5 6.2 2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "border-border bg-surface text-foreground h-(--height-control) w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border px-3 text-sm shadow-sm transition-colors",
        "hover:border-muted-foreground/40 focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2",
        "data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "[&>span]:min-w-0 [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "border-border bg-surface text-foreground min-w-(--radix-select-trigger-width) shadow-popover z-50 max-h-72 overflow-hidden rounded-md border",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && "min-w-(--radix-select-trigger-width) w-full",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("text-muted-foreground px-2 py-1.5 text-xs font-medium", className)}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
        "focus:bg-muted focus:text-foreground data-[state=checked]:font-medium",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="text-accent absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckMark />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />
  );
}

export { Select, SelectGroup, SelectValue };
