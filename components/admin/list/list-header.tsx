import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ListTab = {
  label: string;
  href: string;
  count?: number | null;
  active?: boolean;
  alert?: boolean;
};

// Шапка списка в одну строку: заголовок, вкладки со счётчиками, кнопки.
// Список заявок виден уже на первом экране.
export function ListHeader({
  title,
  tabs,
  actions,
}: {
  title: string;
  tabs: ListTab[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <h1 className="shrink-0 text-[26px] font-bold tracking-[-0.02em] sm:text-[28px]">
          {title}
        </h1>
        <nav
          aria-label="Быстрые фильтры"
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-[12px] bg-[var(--surface-muted)] p-1"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href + tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-[9px] px-3 text-[13.5px] font-semibold whitespace-nowrap text-[var(--muted)] transition hover:text-[var(--foreground)]",
                tab.active &&
                  "bg-white text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count !== null ? (
                <b
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    tab.alert && tab.count > 0
                      ? "text-red-600"
                      : "text-zinc-500",
                  )}
                >
                  {tab.count}
                </b>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 xl:ml-auto">{actions}</div>
      ) : null}
    </header>
  );
}
