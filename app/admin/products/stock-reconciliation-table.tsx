"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StockProductPicker } from "@/app/admin/products/stock-product-picker";
import {
  type StockProductOption,
  type StockReconciliationEntry,
  stockImportStatusLabels,
} from "@/features/admin/stock-import";

const filters = [
  ["issues", "Все расхождения"],
  ["difference", "Количество отличается"],
  ["review", "Нужна проверка"],
  ["notFound", "Нет на сайте"],
  ["missing", "Нет в файле"],
  ["unchanged", "Совпадает"],
  ["all", "Все товары"],
] as const;
type Filter = (typeof filters)[number][0];
const quantity = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 10 });
const pageSize = 50;

export function StockReconciliationTable({
  entries,
  selected,
  onSelection,
  disabled,
  preview,
  manualLinks = {},
  onLink,
}: {
  entries: StockReconciliationEntry[];
  selected: Set<string>;
  onSelection: (keys: Set<string>) => void;
  disabled: boolean;
  preview: boolean;
  manualLinks?: Record<string, StockProductOption>;
  onLink?: (linkKey: string, product: StockProductOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("issues");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
    return entries.filter(
      (entry) =>
        (filter === "all" ||
          (filter === "issues"
            ? entry.kind !== "unchanged"
            : entry.kind === filter)) &&
        (!search ||
          `${entry.sku} ${entry.name}`
            .toLocaleLowerCase("ru-RU")
            .replaceAll("ё", "е")
            .includes(search)),
    );
  }, [entries, query, filter]);
  const counts = useMemo(() => {
    const result = {
      issues: 0,
      difference: 0,
      review: 0,
      notFound: 0,
      missing: 0,
      unchanged: 0,
      all: entries.length,
    };
    for (const entry of entries) {
      result[entry.kind]++;
      if (entry.kind !== "unchanged") result.issues++;
    }
    return result;
  }, [entries]);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const eligible = filtered.filter((entry) => entry.selectable);
  const allSelected =
    eligible.length > 0 && eligible.every((entry) => selected.has(entry.key));
  function toggle(keys: string[], checked: boolean) {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onSelection(next);
  }
  return (
    <section className="min-w-0 space-y-3" aria-label="Сверка остатков">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="relative block">
          <span className="sr-only">Поиск по артикулу или названию</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Артикул или название"
            className="pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Результат сверки</span>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as Filter);
              setPage(0);
            }}
            className="min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label} · {counts[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview && (
        <label className="flex min-h-10 items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            disabled={disabled || !eligible.length}
            checked={allSelected}
            onChange={(event) =>
              toggle(
                eligible.map((entry) => entry.key),
                event.target.checked,
              )
            }
            className="size-4 accent-emerald-700"
          />
          Выбрать доступные в текущем списке ({eligible.length}) · Выбрано:{" "}
          {selected.size}
        </label>
      )}
      <div
        className="max-h-[32rem] overflow-auto border-y border-zinc-200"
        tabIndex={0}
        role="region"
        aria-label="Сравнение количества товаров"
      >
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-100">
            <tr>
              {preview && (
                <th className="w-10 p-2">
                  <span className="sr-only">Выбор</span>
                </th>
              )}
              <th className="p-2">Товар / артикул</th>
              <th className="p-2 text-right">
                На сайте{!preview && " (было)"}
              </th>
              <th className="p-2 text-right">В файле</th>
              <th className="p-2 text-right">Разница</th>
              <th className="p-2">Результат</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr
                key={entry.key}
                className="border-t border-zinc-200 align-top"
              >
                {preview && (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label={`Обновить ${entry.name || entry.sku}`}
                      disabled={disabled || !entry.selectable}
                      checked={selected.has(entry.key)}
                      onChange={(event) =>
                        toggle([entry.key], event.target.checked)
                      }
                      className="size-4 accent-emerald-700"
                    />
                  </td>
                )}
                <td className="max-w-64 p-2 break-words">
                  <p className="font-medium">{entry.name || entry.sku}</p>
                  <p className="mt-1 font-mono break-all text-zinc-500">
                    {entry.sku}
                  </p>
                </td>
                <td className="p-2 text-right tabular-nums">
                  {quantity(entry.siteQuantity)}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {quantity(entry.fileQuantity)}
                  <span className="ml-1 text-zinc-500">{entry.unit}</span>
                </td>
                <td
                  className={`p-2 text-right font-semibold tabular-nums ${entry.difference ? "text-amber-800" : "text-zinc-500"}`}
                >
                  {entry.difference !== null && entry.difference > 0 ? "+" : ""}
                  {quantity(entry.difference)}
                </td>
                <td className="max-w-60 p-2">
                  <p
                    className={
                      entry.selectable || entry.status === "updated"
                        ? "font-medium text-emerald-800"
                        : "font-medium text-zinc-700"
                    }
                  >
                    {entry.kind === "missing"
                      ? "Нет в файле"
                      : entry.kind === "notFound"
                        ? "Нет на сайте"
                        : stockImportStatusLabels[entry.status]}
                  </p>
                  {entry.match === "name" && (
                    <p className="mt-1 text-amber-800">
                      Сопоставлено по названию
                    </p>
                  )}
                  {entry.match === "similar" && (
                    <p className="mt-1 text-amber-800">
                      Похожее название, проверьте
                    </p>
                  )}
                  {entry.match === "linked" && (
                    <p className="mt-1 text-emerald-800">
                      Запомненное совпадение
                    </p>
                  )}
                  {preview && entry.linkKey && manualLinks[entry.linkKey] && (
                    <p className="mt-1 text-emerald-800">
                      На сайте:{" "}
                      <strong>{manualLinks[entry.linkKey].name}</strong>{" "}
                      <span className="font-mono text-zinc-500">
                        {manualLinks[entry.linkKey].sku}
                      </span>
                      . Остаток {quantity(entry.fileQuantity)} запишется при
                      «Применить».
                      {onLink ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onLink(entry.linkKey!, null)}
                          className="ml-2 text-zinc-500 underline underline-offset-2"
                        >
                          Отменить
                        </button>
                      ) : null}
                    </p>
                  )}
                  {entry.reason && (
                    <p className="mt-1 leading-5 text-zinc-600">
                      {entry.reason}
                    </p>
                  )}
                  {preview &&
                  onLink &&
                  entry.linkKey &&
                  !manualLinks[entry.linkKey] &&
                  entry.match === null &&
                  (entry.kind === "notFound" || entry.kind === "review") ? (
                    <StockProductPicker
                      suggestions={entry.suggestions ?? []}
                      disabled={disabled}
                      onPick={(product) => onLink(entry.linkKey!, product)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="p-6 text-center text-sm text-zinc-500">
            Товары не найдены
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
        <span>
          {filtered.length ? currentPage * pageSize + 1 : 0}–
          {Math.min((currentPage + 1) * pageSize, filtered.length)} из{" "}
          {filtered.length}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            title="Предыдущая страница"
            aria-label="Предыдущая страница"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="grid size-10 place-items-center rounded-md border border-zinc-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            title="Следующая страница"
            aria-label="Следующая страница"
            disabled={(currentPage + 1) * pageSize >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
            className="grid size-10 place-items-center rounded-md border border-zinc-200 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
