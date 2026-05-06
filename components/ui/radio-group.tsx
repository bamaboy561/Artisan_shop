"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type RadioGroupProps = {
  name: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

export function RadioGroup({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: RadioGroupProps) {
  const fallbackId = useId();

  return (
    <div className={cn("grid gap-2", className)}>
      {options.map((option) => {
        const id = `${fallbackId}-${name}-${option.value}`;
        const checked =
          value === undefined ? undefined : value === option.value;
        const defaultChecked =
          value === undefined ? defaultValue === option.value : undefined;

        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-1 py-1 transition hover:border-[color:var(--line)]",
              option.disabled && "cursor-not-allowed opacity-55",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              defaultChecked={defaultChecked}
              onChange={(event) => onValueChange?.(event.target.value)}
              disabled={option.disabled}
              className="mt-0.5 size-4 border-[color:var(--line-strong)] bg-white accent-[var(--accent)]"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {option.label}
              </span>
              {option.description ? (
                <span className="block text-xs leading-5 text-[var(--muted)]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
