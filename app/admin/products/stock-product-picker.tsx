"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { searchStockProductsAction } from "@/app/admin/products/stock-import-actions";
import type { StockProductOption } from "@/features/admin/stock-import";

// «Это он»: выбор товара сайта для строки 1С. Сначала похожие товары,
// а если нужного среди них нет, поиск по названию или артикулу.
export function StockProductPicker({
  suggestions,
  onPick,
  disabled,
  search = searchStockProductsAction,
}: {
  suggestions: StockProductOption[];
  onPick: (product: StockProductOption) => void;
  disabled?: boolean;
  search?: (query: string) => Promise<StockProductOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<StockProductOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await search(text);
        if (request.current === id) setFound(next);
      } catch {
        if (request.current === id) setFound([]);
      } finally {
        if (request.current === id) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!open)
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-2 rounded-full border border-emerald-700 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
      >
        Это он…
      </button>
    );

  const options =
    query.trim().length >= 2 && found !== null ? found : suggestions;
  return (
    <div className="mt-2 min-w-0 space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
      <label className="relative block">
        <span className="sr-only">Найти товар на сайте</span>
        <Search className="pointer-events-none absolute top-2 left-2 size-3.5 text-zinc-500" />
        <input
          autoFocus
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 2) setFound(null);
          }}
          placeholder="Название или артикул на сайте"
          className="min-h-8 w-full rounded-md border border-zinc-300 py-1 pr-2 pl-7 text-xs"
        />
      </label>
      {loading ? (
        <p className="flex items-center gap-1 text-xs text-zinc-500">
          <LoaderCircle className="size-3.5 animate-spin" /> Ищем…
        </p>
      ) : null}
      {options.length ? (
        <ul className="max-h-48 space-y-1 overflow-auto">
          {options.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onPick(product);
                }}
                className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-emerald-50 disabled:opacity-50"
              >
                <span className="font-medium">{product.name}</span>{" "}
                <span className="font-mono text-zinc-500">{product.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="text-xs text-zinc-500">
          {query.trim().length >= 2
            ? "Ничего не найдено"
            : "Похожих нет. Начните вводить название."}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        Закрыть
      </button>
    </div>
  );
}
