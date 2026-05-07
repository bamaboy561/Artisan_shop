import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  CatalogSidebar,
  CatalogToolbar,
} from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/ui/cards";
import { Pagination } from "@/components/ui/pagination";
import {
  catalogCategories,
  catalogMetrics,
  catalogProducts,
} from "@/features/catalog/data";
import {
  buildCatalogHref,
  filterCatalogProducts,
  getCatalogFacetOptions,
  getCatalogFilterOptions,
  paginateCatalogProducts,
  parseCatalogSearchParams,
  sanitizeCatalogFilterState,
  sortCatalogProducts,
} from "@/features/catalog/filters";

export const metadata: Metadata = {
  title: "Каталог",
  description:
    "Каталог мебельных панелей ЛДСП, МДФ и декоров от EXTRAVERT, SWISS KRONO и AGT. Фильтры, сортировка и быстрый запрос цены.",
};

type CatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const heroProducts = catalogProducts.slice(0, 3);

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const parsedState = parseCatalogSearchParams(await searchParams);
  const availableFilterOptions = getCatalogFilterOptions(catalogProducts);
  const state = sanitizeCatalogFilterState(parsedState, availableFilterOptions);
  const filterOptions = getCatalogFacetOptions(catalogProducts, state);
  const filteredProducts = filterCatalogProducts(catalogProducts, state);
  const sortedProducts = sortCatalogProducts(filteredProducts, state.sort);
  const pagination = paginateCatalogProducts(sortedProducts, state.page);
  const resolvedState = { ...state, page: pagination.currentPage };

  return (
    <div className="bg-[#f1eee8]">
      <section className="border-b border-[color:var(--line)] bg-[#f1eee8] px-4 pt-3 pb-2.5 lg:hidden">
        <div className="mx-auto max-w-[1500px] space-y-2">
          <p className="font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
            Каталог Artisan
          </p>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.18rem] leading-[1.02] font-semibold tracking-[-0.045em] text-[var(--foreground)]">
                Материалы и декоры
              </h1>
            </div>

            <div className="shrink-0 text-right font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
              <p className="text-[var(--foreground)]">{catalogProducts.length}</p>
              <p>позиций</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
            <span>{catalogMetrics.brandCount} бренда</span>
            <span>{catalogCategories.length} раздела</span>
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[#858866] text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.12)_52%,rgba(0,0,0,0.72)_100%)]" />
        <div className="mx-auto flex min-h-[40svh] max-w-[1500px] flex-col justify-end px-8 pt-[4.5rem] pb-8 lg:px-10">
          <div className="absolute top-16 right-10 hidden h-[24svh] w-[44rem] items-end justify-end gap-4 xl:flex">
            {heroProducts.map((product, index) => (
              <div
                key={product.slug}
                className={`relative overflow-hidden bg-white/12 shadow-[0_26px_80px_rgba(0,0,0,0.16)] ring-1 ring-white/12 ${
                  index === 1 ? "h-[24svh] w-[15rem]" : "h-[18svh] w-[11.5rem]"
                }`}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="20vw"
                />
              </div>
            ))}
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-[34rem]">
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
                Каталог Artisan
              </p>
              <h1 className="mt-2.5 text-[1.62rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:mt-3 sm:text-[2.6rem]">
                Каталог материалов.
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-right font-mono text-[9px] tracking-[0.14em] text-white/62 uppercase sm:gap-5 sm:text-[10px]">
              <div>
                <p className="text-base font-semibold tracking-normal text-white sm:text-xl">
                  {catalogProducts.length}
                </p>
                <p>позиций</p>
              </div>
              <div>
                <p className="text-base font-semibold tracking-normal text-white sm:text-xl">
                  {catalogMetrics.brandCount}
                </p>
                <p>бренда</p>
              </div>
              <div>
                <p className="text-base font-semibold tracking-normal text-white sm:text-xl">
                  {catalogCategories.length}
                </p>
                <p>раздела</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[color:var(--line)] bg-[#f1eee8] px-4 py-2.5 sm:px-8 sm:py-4 lg:px-10">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-auto sm:flex sm:max-w-[1500px] sm:flex-wrap sm:gap-3 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap sm:gap-3">
            {catalogCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className="inline-flex h-8.5 items-center border border-[color:var(--line)] bg-white/70 px-3 font-mono text-[9px] tracking-[0.14em] text-[var(--foreground)] uppercase transition sm:h-10 sm:px-4 sm:text-[10px] hover:border-[var(--foreground)]"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href="/calculator"
              className="inline-flex h-8.5 items-center border border-[color:var(--foreground)] bg-[var(--foreground)] px-3 font-mono text-[9px] tracking-[0.14em] text-white uppercase transition sm:h-10 sm:px-4 sm:text-[10px] hover:bg-transparent hover:text-[var(--foreground)]"
            >
              Калькулятор распила
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 pt-2.5 pb-5 sm:px-8 sm:py-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <CatalogSidebar state={resolvedState} options={filterOptions} />

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <CatalogToolbar
              state={resolvedState}
              options={filterOptions}
              resultCount={pagination.totalItems}
              totalCount={catalogProducts.length}
            />

            {pagination.items.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-9 xl:grid-cols-3">
                  {pagination.items.map((product) => (
                    <ProductCard
                      key={product.slug}
                      href={`/product/${product.slug}`}
                      brand={product.brand}
                      name={product.name}
                      summary={product.summary}
                      format={product.format}
                      action={product.action}
                      image={product.image}
                      price={product.price}
                      oldPrice={product.oldPrice}
                      inStock={product.inStock}
                      categoryName={product.categoryName}
                      denseMobile
                      mobileList
                    />
                  ))}
                </div>

                {pagination.totalPages > 1 ? (
                  <div className="flex min-w-0 flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-6">
                    <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                      Страница {pagination.currentPage} из {pagination.totalPages}
                    </p>
                    <Pagination
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      getHref={(page) =>
                        buildCatalogHref("/catalog", {
                          ...resolvedState,
                          page,
                        })
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 text-center sm:p-12">
                <p className="text-xl font-semibold text-[var(--foreground)]">
                  По этим параметрам ничего не найдено.
                </p>
                <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-[var(--muted)] sm:leading-7">
                  Сбросьте часть фильтров или измените поисковый запрос.
                </p>
                <Link
                  href="/catalog"
                  className="mt-6 inline-flex h-10 items-center border border-[var(--foreground)] px-6 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition sm:mt-7 sm:h-11 sm:px-8 sm:text-[11px] hover:bg-[var(--foreground)] hover:text-white"
                >
                  Сбросить фильтры
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
