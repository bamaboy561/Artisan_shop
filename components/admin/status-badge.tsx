import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-black/6 bg-[#f0efed] text-[#5f5b55]",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-orange-100 bg-orange-50 text-orange-700",
  accent: "border-blue-100 bg-blue-50 text-blue-700",
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
        "inline-flex items-center rounded-md border px-2 py-1 text-xs leading-none font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
