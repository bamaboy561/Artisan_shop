"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";

import { toggleFavoriteAction } from "@/app/account/actions";
import type { CartItem } from "@/components/providers/cart-provider";

export function SaveCartAsProject({ items }: { items: CartItem[] }) {
  const [projectName, setProjectName] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (items.length === 0) return null;

  const handleSave = () => {
    const name = projectName.trim() || "Проект";
    startTransition(async () => {
      for (const item of items) {
        await toggleFavoriteAction(item.productSlug, name);
      }
      setDone(true);
      setProjectName("");
      setTimeout(() => setDone(false), 3000);
    });
  };

  return (
    <div className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
      <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
        Сохранить как проект
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Все товары корзины сохранятся в избранное с меткой проекта.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Название проекта"
          className="h-10 min-w-0 flex-1 border border-[color:var(--line)] bg-white px-4 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 bg-[var(--foreground)] px-6 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {done ? "Сохранено!" : pending ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}