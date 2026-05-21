"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import type { FeaturedProduct } from "@/features/catalog/types";

export function SearchAutocomplete({ products }: { products: FeaturedProduct[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = query.trim().length > 0
    ? products
        .filter((p) => p.searchText.includes(query.toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder="Поиск по каталогу..."
        className="h-10 w-full border border-[color:var(--line)] bg-white px-4 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
      />
      {open && suggestions.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 border border-[color:var(--line)] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.1)]">
          {suggestions.map((product) => (
            <Link
              key={product.slug}
              href={`/product/${product.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3 text-sm transition hover:bg-[var(--surface)] last:border-b-0"
            >
              <span>
                <span className="font-medium text-[var(--foreground)]">{product.name}</span>
                <span className="ml-2 text-[var(--muted)]">{product.brand}</span>
              </span>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                {typeof product.price === "number" ? new Intl.NumberFormat("ru-RU").format(product.price) + " KGS" : product.action}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      {open && query.trim() && suggestions.length === 0 ? (
        <div className="absolute inset-x-0 top-full z-20 border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)] shadow-[0_16px_48px_rgba(0,0,0,0.1)]">
          Ничего не найдено. Попробуйте другой запрос.
        </div>
      ) : null}
    </div>
  );
}