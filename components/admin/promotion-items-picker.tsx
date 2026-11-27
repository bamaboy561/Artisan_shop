"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { rankProductSearch } from "@/features/admin/product-search";
import { cn } from "@/lib/utils";

export type PromotionPickerItem = {
  id: string;
  name: string;
  sku: string;
  categoryName?: string;
};

type PromotionItemsPickerProps = {
  /** Name of the hidden inputs, one per selected id. */
  name: string;
  label: string;
  items: PromotionPickerItem[];
  defaultSelectedIds?: string[];
  placeholder?: string;
  emptyText?: string;
};

const visibleLimit = 60;

// Several products (or categories) in one promotion: search, tap to add,
// tap the chip cross to remove. Each selected id goes to the form as its own
// hidden input, so the server reads them with formData.getAll(name).
export function PromotionItemsPicker({
  name,
  label,
  items,
  defaultSelectedIds = [],
  placeholder = "Название или артикул",
  emptyText = "Ничего не выбрано",
}: PromotionItemsPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    Array.from(new Set(defaultSelectedIds)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultKey = defaultSelectedIds.join(",");
  // После успешной отправки React сбрасывает форму (form.reset()), но выбор
  // хранится в состоянии: сбрасываем его вместе с формой, иначе следующая
  // акция получит товары предыдущей.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => {
      setSelectedIds(
        defaultKey ? Array.from(new Set(defaultKey.split(","))) : [],
      );
      setQuery("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultKey]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const matches = useMemo(
    () => (query.trim() ? rankProductSearch(items, query) : items),
    [items, query],
  );
  const visible = matches.slice(0, visibleLimit);
  const notSelectedMatches = query.trim()
    ? matches.filter((item) => !selectedSet.has(item.id))
    : [];

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function addAllMatches() {
    setSelectedIds((current) => [
      ...current,
      ...notSelectedMatches.map((item) => item.id),
    ]);
  }

  return (
    <div
      ref={rootRef}
      className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-xs text-[var(--muted)]">
          Выбрано: {selectedIds.length}
        </span>
      </div>

      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {selectedIds.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const item = itemsById.get(id);
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1 border border-[color:var(--line)] bg-[var(--surface)] py-1 pr-1 pl-2.5 text-xs"
              >
                <span className="min-w-0 truncate">
                  {item ? item.name : "Удалённая позиция"}
                  {item?.sku ? (
                    <span className="text-[var(--muted)]"> · {item.sku}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Убрать ${item?.name ?? ""}`}
                  className="inline-flex size-6 shrink-0 items-center justify-center text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="px-2 py-1 text-xs text-[var(--muted)] underline-offset-2 hover:text-red-600 hover:underline"
          >
            Очистить всё
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">{emptyText}</p>
      )}

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter here must not submit the whole promotion form.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={placeholder}
          className="pl-9 sm:pl-10"
          aria-label={`Поиск: ${label}`}
        />
      </div>

      {notSelectedMatches.length > 1 ? (
        <button
          type="button"
          onClick={addAllMatches}
          className="justify-self-start text-xs font-medium text-[var(--accent)] hover:underline"
        >
          + Добавить все найденные ({notSelectedMatches.length})
        </button>
      ) : null}

      <ul className="max-h-64 overflow-y-auto border border-[color:var(--line)] bg-[var(--surface-strong)]">
        {visible.length === 0 ? (
          <li className="px-3 py-3 text-xs text-[var(--muted)]">
            Ничего не нашлось
          </li>
        ) : (
          visible.map((item) => {
            const isSelected = selectedSet.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2.5 border-b border-[color:var(--line)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--surface)]",
                    isSelected && "bg-[var(--accent)]/8",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center border",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[color:var(--line)] text-[var(--muted)]",
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.name}</span>
                    {item.sku || item.categoryName ? (
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {[item.sku, item.categoryName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
        {matches.length > visible.length ? (
          <li className="px-3 py-2 text-xs text-[var(--muted)]">
            Показаны первые {visibleLimit} из {matches.length}. Уточните поиск.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
