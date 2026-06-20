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
          .filter((product) => product.searchText.includes(normalizedQuery))
          .slice(0, 5)
      : [];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      router.push(catalogSearchHref(query));
    });
  }

  return (
    <section className="bg-background px-4 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[8px] border border-[#e2dbd1] bg-[linear-gradient(135deg,#fffdf9_0%,#f7f1e8_100%)] p-4 shadow-[0_18px_48px_rgba(37,31,24,0.08)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
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
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[8px] border border-[#ddd3c7] bg-white/96 shadow-[0_8px_24px_rgba(37,31,24,0.06)] transition focus-within:border-[#c56c45] focus-within:shadow-[0_10px_30px_rgba(197,108,69,0.14)] sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <Search
                aria-hidden
                className="ml-4 h-4 w-4 text-[#8b7d70] sm:ml-5"
              />
              <input
                id="home-catalog-search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введите название, бренд или артикул"
                className="h-[52px] min-w-0 bg-transparent px-3 text-base text-[var(--foreground)] outline-none placeholder:text-[#8b7d70] sm:h-14 sm:px-4 sm:text-lg"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isPending}
                className="col-span-2 mx-2 mb-2 inline-flex h-11 items-center justify-center rounded-[6px] bg-[#171411] px-5 font-mono text-[10px] tracking-[0.14em] text-white uppercase transition hover:bg-[#c56c45] disabled:cursor-wait disabled:opacity-70 sm:col-span-1 sm:mr-2 sm:mb-0 sm:h-10"
              >
                Найти
              </button>
            </div>
          </form>

          <div className="grid gap-2 xl:max-w-[44rem]">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[#8b7d70] uppercase xl:text-right">
              Быстрый выбор
            </p>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {quickSearches.map((item) => (
                <Link
                  key={item}
                  href={catalogSearchHref(item)}
                  className="inline-flex h-10 items-center rounded-[6px] border border-[#ddd3c7] bg-white/72 px-3.5 text-sm text-[var(--foreground)] shadow-[0_4px_14px_rgba(37,31,24,0.04)] transition hover:border-[#c56c45] hover:bg-white hover:text-[#9f4f32]"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-4 grid gap-2 border-t border-[#e6ded3] pt-4 sm:grid-cols-2 lg:grid-cols-5">
            {suggestions.map((product) => (
              <Link
                key={product.slug}
                href={`/product/${product.slug}`}
                className="group min-w-0 rounded-[8px] border border-[#ddd3c7] bg-white/72 p-3 shadow-[0_8px_20px_rgba(37,31,24,0.04)] transition hover:border-[#c56c45] hover:bg-white"
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
