"use client";

import type { ReactElement } from "react";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@agentforge/ui";

export type FormSelectOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * Drop-in replacement for a labelled native <select> inside server-action and
 * GET forms. Radix renders the real form value into a hidden bubble, so
 * submission behaves exactly like the native control it replaces.
 */
export function FormSelect({
  id,
  name,
  label,
  hideLabel = false,
  options,
  defaultValue,
  value,
  onValueChange,
  required = false,
  disabled = false,
  placeholder,
  className,
  triggerClassName,
}: {
  readonly id?: string;
  readonly name: string;
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly options: readonly FormSelectOption[];
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly triggerClassName?: string;
}): ReactElement {
  // Match the native <select> this replaces: with no explicit default, the
  // first option is the selected value, so server actions always get one.
  const initialValue = defaultValue ?? (value === undefined ? options[0]?.value : undefined);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {hideLabel ? null : <Label id={id ? `${id}-label` : undefined}>{label}</Label>}
      <Select
        name={name}
        defaultValue={initialValue}
        value={value}
        onValueChange={onValueChange}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label={label}
          aria-labelledby={id ? `${id}-label` : undefined}
          className={triggerClassName}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
