"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";

type HomeCatalogSearchProduct = {
  slug: string;
  name: string;
  sku: string;
  brand: string;
  categoryName: string;
  searchText: string;
};

type HomeCatalogSearchProps = {
  products: HomeCatalogSearchProduct[];
};

const quickSearches = [
  "ЛДСП",
  "МДФ",
  "AGT",
  "Swiss Krono",
  "петли",
  "направляющие",
];

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function catalogSearchHref(query: string) {
  const params = new URLSearchParams();
  const normalized = query.trim();

  if (normalized) {
    params.set("q", normalized);
  }

  const queryString = params.toString();
  return queryString ? `/catalog?${queryString}` : "/catalog";
}

export function HomeCatalogSearch({ products }: HomeCatalogSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const normalizedQuery = normalizeSearch(query);
  const suggestions =
    normalizedQuery.length >= 2
      ? products
          .filter((product) =>
            product.searchText.includes(normalizedQuery),
          )
          .slice(0, 5)
      : [];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      router.push(catalogSearchHref(query));
    });
  }

  return (
    <section className="bg-background px-4 py-3 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-3 shadow-[0_18px_60px_rgba(20,18,14,0.06)] sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <form
            action="/catalog"
            className="grid gap-2"
            onSubmit={handleSubmit}
          >
            <label
              htmlFor="home-catalog-search"
              className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase"
            >
              Поиск по каталогу
            </label>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center border border-[color:var(--line)] bg-white">
              <Search
                aria-hidden
                className="ml-3 h-4 w-4 text-[var(--muted)] sm:ml-4"
              />
              <input
                id="home-catalog-search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введите название, бренд или артикул"
                className="h-12 min-w-0 bg-transparent px-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] sm:h-14 sm:text-lg"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isPending}
                className="mr-1 inline-flex h-10 items-center justify-center bg-[var(--foreground)] px-4 font-mono text-[10px] tracking-[0.14em] text-white uppercase transition hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-70 sm:mr-2 sm:h-11 sm:px-5"
              >
                Найти
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 lg:max-w-[34rem] lg:justify-end">
            {quickSearches.map((item) => (
              <Link
                key={item}
                href={catalogSearchHref(item)}
                className="inline-flex h-9 items-center border border-[color:var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] transition hover:border-[var(--foreground)] hover:bg-white"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-3 grid gap-2 border-t border-[color:var(--line)] pt-3 sm:grid-cols-2 lg:grid-cols-5">
            {suggestions.map((product) => (
              <Link
                key={product.slug}
                href={`/product/${product.slug}`}
                className="group min-w-0 border border-[color:var(--line)] bg-[var(--surface)] p-3 transition hover:border-[var(--foreground)] hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {product.name}
                  </p>
                  <ArrowUpRight
                    aria-hidden
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--accent)]"
                  />
                </div>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {product.brand} · {product.sku || product.categoryName}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
