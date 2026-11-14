"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type {
  ConstructorDecor,
  ConstructorFittingProduct,
} from "@/lib/server/constructor-decors";

import { FurnitureConstructor } from "./furniture-constructor";
import { KitchenConstructor } from "./kitchen-constructor";

type Tab = "cabinet" | "kitchen";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "cabinet", label: "Шкафы и тумбы" },
  { id: "kitchen", label: "Кухня целиком" },
];

// Вкладки конструктора: отдельный корпус или вся кухня. Ссылка
// /konstruktor#kitchen открывает кухню.
export function ConstructorTabs(props: {
  decors: ConstructorDecor[];
  fittingProducts: ConstructorFittingProduct[];
}) {
  const [tab, setTab] = useState<Tab>("cabinet");
  useEffect(() => {
    const fromHash = () =>
      setTab(window.location.hash === "#kitchen" ? "kitchen" : "cabinet");
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const choose = (next: Tab) => {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      next === "kitchen" ? "#kitchen" : window.location.pathname,
    );
  };

  return (
    <div className="grid gap-5">
      <div
        role="tablist"
        className="inline-flex w-fit rounded-full border border-[color:var(--line)] bg-[var(--surface-strong)] p-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => choose(item.id)}
            className={cn(
              "rounded-full px-5 py-2 text-[14px] font-semibold",
              tab === item.id
                ? "bg-[var(--foreground)] text-[var(--surface)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "kitchen" ? (
        <KitchenConstructor {...props} />
      ) : (
        <FurnitureConstructor {...props} />
      )}
    </div>
  );
}
