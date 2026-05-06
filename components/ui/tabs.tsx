"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  defaultTabId?: string;
  className?: string;
};

export function Tabs({ tabs, defaultTabId, className }: TabsProps) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId ?? tabs[0]?.id);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (!activeTab) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="inline-flex w-full flex-wrap gap-2 rounded-2xl border border-[color:var(--line)] bg-white/74 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none",
              tab.id === activeTab.id
                ? "bg-[var(--foreground)] text-white"
                : "text-[var(--foreground)]/80 hover:bg-[var(--surface)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="surface-glow rounded-2xl border border-[color:var(--line)] bg-white/74 p-5">
        {activeTab.content}
      </div>
    </div>
  );
}
