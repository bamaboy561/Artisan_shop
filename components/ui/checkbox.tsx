import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export function Checkbox({
  className,
  label,
  description,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border border-transparent px-1 py-1 transition hover:border-[color:var(--line)]",
        props.disabled && "cursor-not-allowed opacity-55",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 border-[color:var(--line-strong)] bg-white accent-[var(--accent)]"
        {...props}
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-[var(--foreground)]">
          {label}
        </span>
        {description ? (
          <span className="block text-xs leading-5 text-[var(--muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
