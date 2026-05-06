import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-black/8 bg-black/5 text-[var(--muted)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  accent:
    "border-[color:var(--accent)]/18 bg-[var(--accent)]/10 text-[var(--accent)]",
} as const;

type StatusBadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
