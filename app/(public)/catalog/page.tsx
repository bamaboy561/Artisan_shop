import type { Metadata } from "next";
import Link from "next/link";

import {
  CatalogSidebar,
  CatalogToolbar,
} from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/ui/cards";
import { Pagination } from "@/components/ui/pagination";
import { StructuredData } from "@/components/seo/structured-data";
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
import {
  getCatalogMetrics,
  getPublicCategories,
  getPublicProducts,
} from "@/lib/server/catalog-public";
import { getCurrentFavoriteProductSlugs } from "@/lib/server/favorites";
import { collectionJsonLd, createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Каталог ЛДСП, МДФ, панелей и мебельной фурнитуры",
  description:
    "Каталог Artisan в Бишкеке: ЛДСП, МДФ панели, мебельные декоры, кромка и фурнитура. EXTRAVERT, SWISS KRONO, AGT, фильтры и запрос цены.",
  path: "/catalog",
});

type CatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [
    catalogProducts,
    catalogCategories,
    catalogMetrics,
    favoriteSlugs,
    parsedSearchParams,
  ] = await Promise.all([
    getPublicProducts(),
    getPublicCategories(),
    getCatalogMetrics(),
    getCurrentFavoriteProductSlugs(),
    searchParams,
  ]);
  const parsedState = parseCatalogSearchParams(parsedSearchParams);
  const availableFilterOptions = getCatalogFilterOptions(catalogProducts);
  const state = sanitizeCatalogFilterState(parsedState, availableFilterOptions);
  const filterOptions = getCatalogFacetOptions(catalogProducts, state);
  const filteredProducts = filterCatalogProducts(catalogProducts, state);
  const sortedProducts = sortCatalogProducts(filteredProducts, state.sort);
  const pagination = paginateCatalogProducts(sortedProducts, state.page);
  const resolvedState = { ...state, page: pagination.currentPage };
  const currentHref = buildCatalogHref("/catalog", resolvedState);
  const catalogDescription =
    "Каталог мебельных панелей, МДФ, ЛДСП, декоров и материалов для распила Artisan.";

  return (
    <div className="bg-[#f1eee8]">
      <StructuredData
        data={collectionJsonLd({
          name: "Каталог Artisan",
          description: catalogDescription,
          path: "/catalog",
          products: sortedProducts,
        })}
      />
      <section className="relative overflow-hidden border-b border-[color:var(--line)] bg-gradient-to-b from-[#f6f1e7] via-[#efeadf] to-[#f1eee8]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--foreground)]/12 to-transparent" />
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,#151411_1px,transparent_0)] [background-size:18px_18px] opacity-[0.035]" />

        <div className="relative mx-auto flex max-w-[1500px] flex-col gap-6 px-4 pt-12 pb-10 sm:gap-8 sm:px-8 sm:pt-20 sm:pb-14 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:px-10 lg:pt-24 lg:pb-16">
          <div className="max-w-[42rem]">
            <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--accent)] uppercase sm:text-[11px]">
              Каталог Artisan
            </p>
            <h1 className="mt-3 text-[2.1rem] leading-[0.96] font-semibold tracking-[-0.045em] text-balance text-[var(--foreground)] sm:mt-4 sm:text-[3.4rem] lg:text-[3.8rem]">
              Материалы для проектной мебели.
            </h1>
            <p className="mt-4 max-w-[36rem] text-[14px] leading-[1.7] text-[var(--muted)] sm:mt-5 sm:text-[15px]">
              Подбор плитных материалов, фасадных панелей и кромок под
              конкретный проект — с прозрачным сценарием заказа и сервисом
              распила.
            </p>
          </div>

          {catalogProducts.length > 0 ? (
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 border-t border-[color:var(--line-strong)]/40 pt-5 lg:border-none lg:pt-0">
              <div>
                <dt className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
                  Позиций
                </dt>
                <dd className="mt-1 text-[1.6rem] leading-none font-semibold text-[var(--foreground)] sm:text-[2rem]">
                  {catalogProducts.length}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
                  Брендов
                </dt>
                <dd className="mt-1 text-[1.6rem] leading-none font-semibold text-[var(--foreground)] sm:text-[2rem]">
                  {catalogMetrics.brandCount}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
                  Разделов
                </dt>
                <dd className="mt-1 text-[1.6rem] leading-none font-semibold text-[var(--foreground)] sm:text-[2rem]">
                  {catalogCategories.length}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>

      <section className="border-b border-[color:var(--line)] bg-[#f1eee8] px-4 py-2.5 sm:px-8 sm:py-4 lg:px-10">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-auto sm:flex sm:max-w-[1500px] sm:flex-wrap sm:gap-3 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap sm:gap-3">
            {catalogCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className="inline-flex h-8.5 items-center border border-[color:var(--line)] bg-white/70 px-3 font-mono text-[9px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] sm:h-10 sm:px-4 sm:text-[10px]"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href="/calculator"
              className="inline-flex h-8.5 items-center border border-[color:var(--foreground)] bg-[var(--foreground)] px-3 font-mono text-[9px] tracking-[0.14em] text-white uppercase transition hover:bg-transparent hover:text-[var(--foreground)] sm:h-10 sm:px-4 sm:text-[10px]"
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
                      productSlug={product.slug}
                      isFavorite={favoriteSlugs.has(product.slug)}
                      favoriteNext={currentHref}
                      showFavorite
                      denseMobile
                      mobileList
                    />
                  ))}
                </div>

                {pagination.totalPages > 1 ? (
                  <div className="flex min-w-0 flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-6">
                    <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                      Страница {pagination.currentPage} из{" "}
                      {pagination.totalPages}
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
            ) : catalogProducts.length === 0 ? (
              <div className="relative overflow-hidden border border-[color:var(--line)] bg-[#f7f3ea] px-6 py-14 text-center sm:px-12 sm:py-20">
                <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,#151411_1px,transparent_0)] [background-size:14px_14px] opacity-[0.04]" />
                <div className="relative mx-auto max-w-[36rem]">
                  <span className="inline-flex items-center gap-2 border border-[color:var(--line-strong)]/50 bg-white/70 px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                    <span className="size-1 rounded-full bg-[var(--accent)]" />
                    Каталог в работе
                  </span>
                  <h2 className="mt-5 text-[1.7rem] leading-[1.05] font-semibold tracking-[-0.035em] text-[var(--foreground)] sm:text-[2.1rem]">
                    Материалы скоро появятся в каталоге.
                  </h2>
                  <p className="mt-4 text-[14px] leading-[1.65] text-[var(--muted)] sm:text-[15px]">
                    Команда наполняет витрину коллекциями, форматами и ценами.
                    Если нужно подобрать материал прямо сейчас — напишите
                    менеджеру или оставьте заявку на расчёт.
                  </p>
                  <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                      href="/contacts"
                      className="inline-flex h-11 w-full items-center justify-center bg-[var(--foreground)] px-7 font-mono text-[11px] tracking-[0.16em] text-white uppercase transition hover:bg-[#9d573d] sm:w-auto"
                    >
                      Связаться с менеджером
                    </Link>
                    <Link
                      href="/calculator"
                      className="inline-flex h-11 w-full items-center justify-center border border-[var(--foreground)] px-7 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:bg-[var(--foreground)] hover:text-white sm:w-auto"
                    >
                      Открыть калькулятор
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-[color:var(--line)] bg-[var(--surface-strong)] px-6 py-12 text-center sm:px-12 sm:py-16">
                <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                  По текущему срезу
                </span>
                <h2 className="mt-4 text-[1.4rem] leading-[1.1] font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-[1.7rem]">
                  По выбранным фильтрам ничего не нашлось.
                </h2>
                <p className="mx-auto mt-3 max-w-[32rem] text-[14px] leading-[1.65] text-[var(--muted)]">
                  Снимите часть условий или попробуйте другой поисковый запрос —
                  материалы у нас точно есть.
                </p>
                <Link
                  href="/catalog"
                  className="mt-6 inline-flex h-11 items-center border border-[var(--foreground)] px-7 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:bg-[var(--foreground)] hover:text-white sm:mt-7"
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
