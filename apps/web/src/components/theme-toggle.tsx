"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, type ReactElement } from "react";

import { cn } from "@agentforge/ui";

const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function ThemeToggle({ className }: { className?: string } = {}): ReactElement {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn("border-border bg-muted/40 h-8 w-40 rounded-md border", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "border-border bg-muted/40 grid grid-cols-3 gap-0.5 rounded-md border p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setTheme(option.value);
            }}
            className={cn(
              "h-7 rounded-[0.3rem] text-xs transition-colors",
              active
                ? "bg-surface text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
