"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// Шаг конструктора: номер, заголовок и коротко, что выбрано. Шаги
// сворачиваются, чтобы справа не было длинной простыни полей.
export function ConstructorStep({
  index,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  index: number;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3 open:pb-4"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[13px] font-semibold text-[var(--surface)]">
          {index}
        </span>
        <span className="text-[15px] font-semibold">{title}</span>
        {summary ? (
          <span className="ml-auto min-w-0 truncate text-[12px] text-[var(--muted)] tabular-nums">
            {summary}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}
