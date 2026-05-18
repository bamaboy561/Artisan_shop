import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CatalogSidebar,
  CatalogToolbar,
} from "@/components/catalog/catalog-filters";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProductCard } from "@/components/ui/cards";
import { Pagination } from "@/components/ui/pagination";
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
import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";
import {
  categorySeoDescription,
  categorySeoTitle,
  createSeoMetadata,
} from "@/lib/seo";
import {
  getPublicCategoryBySlug,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Раздел не найден | Artisan",
    };
  }

  return createSeoMetadata({
    title: categorySeoTitle(category),
    description: categorySeoDescription(category),
    path: `/catalog/${category.slug}`,
    ...(category.coverImage ? { images: [category.coverImage] } : {}),
  });
}

const categoryCopy = {
  ldsp: {
    eyebrow: "Мебельные панели",
    title: "Мебельные панели для проектов.",
    description: "EXTRAVERT и SWISS KRONO.",
  },
  "mdf-panels": {
    eyebrow: "AGT / МДФ",
    title: "МДФ панели Trendy и Supramat.",
    description: "Фасадные панели AGT.",
  },
} as const;

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = await getPublicProductsByCategory(category.slug);
  const parsedState = parseCatalogSearchParams(await searchParams);
  const availableFilterOptions = getCatalogFilterOptions(categoryProducts);
  const state = sanitizeCatalogFilterState(parsedState, availableFilterOptions);
  const filterOptions = getCatalogFacetOptions(categoryProducts, state);
  const filteredProducts = filterCatalogProducts(categoryProducts, state);
  const sortedProducts = sortCatalogProducts(filteredProducts, state.sort);
  const pagination = paginateCatalogProducts(sortedProducts, state.page);
  const resolvedState = { ...state, page: pagination.currentPage };
  const basePath = `/catalog/${category.slug}`;
  const copy = categoryCopy[category.slug as keyof typeof categoryCopy] ?? {
    eyebrow: "Раздел каталога",
    title: category.name,
    description: category.summary,
  };
  const heroProducts = categoryProducts.slice(0, 3);

  return (
    <div className="bg-[#f1eee8]">
      <section className="border-b border-[color:var(--line)] bg-[#f1eee8] px-4 pt-3 pb-2.5 lg:hidden">
        <div className="mx-auto max-w-[1500px] space-y-2">
          <Link
            href="/catalog"
            className="inline-flex font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase"
          >
            Каталог / {category.name}
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.18rem] leading-[1.02] font-semibold tracking-[-0.045em] text-[var(--foreground)]">
                {category.name}
              </h1>
              <p className="mt-1 hidden max-w-[28rem] text-[12px] leading-5 text-[var(--muted)] sm:block">
                {copy.description}
              </p>
            </div>

            <div className="shrink-0 text-right font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
              <p className="text-[var(--foreground)]">{categoryProducts.length}</p>
              <p>позиций</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
            <span>{availableFilterOptions.brands.length} бренда</span>
            {availableFilterOptions.groups.length > 0 ? (
              <span>{availableFilterOptions.groups.length} подкатегории</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[#151411] text-white lg:block">
        <Image
          src={category.coverImage}
          alt={category.name}
          fill
          className="object-cover opacity-28"
          sizes="100vw"
          priority
          unoptimized={shouldBypassNextImageOptimization(category.coverImage)}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.48)_54%,rgba(0,0,0,0.78)_100%)]" />
        <div className="relative mx-auto flex min-h-[48svh] max-w-[1500px] flex-col justify-end px-8 pt-20 pb-8 lg:px-10">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Каталог", href: "/catalog" },
                { label: category.name },
              ]}
              className="text-white/72 [&_a:hover]:text-white [&_span]:text-white/72"
            />
          </div>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-[35rem]">
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
                {copy.eyebrow}
              </p>
              <h1 className="mt-3 text-[2.15rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-[3rem]">
                {copy.title}
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {heroProducts.map((product) => (
                <Link
                  key={product.slug}
                  href={`/product/${product.slug}`}
                  className="group block w-28"
                >
                  <div className="relative aspect-square overflow-hidden bg-white/14 ring-1 ring-white/14">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-[1.04]"
                      sizes="112px"
                      unoptimized={shouldBypassNextImageOptimization(product.image)}
                    />
                  </div>
                  <p className="mt-2 line-clamp-1 font-mono text-[9px] tracking-[0.12em] text-white/64 uppercase">
                    {product.brand}
                  </p>
                </Link>
              ))}
            </div>
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
              totalCount={categoryProducts.length}
            />

            {pagination.items.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-9 xl:grid-cols-3">
                  {pagination.items.map((product) => (
                    <ProductCard
                      key={product.slug}
                      slug={product.slug}
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
                      purchaseMode={product.purchaseMode}
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
                        buildCatalogHref(basePath, {
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
                  Сбросьте фильтры или вернитесь к полной выдаче раздела.
                </p>
                <Link
                  href={basePath}
                  className="mt-6 inline-flex h-10 items-center border border-[var(--foreground)] px-6 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition sm:mt-7 sm:h-11 sm:px-8 sm:text-[11px] hover:bg-[var(--foreground)] hover:text-white"
                >
                  Сбросить фильтры
                </Link>
              </div>
            )}

            <Link
              href="/catalog"
              className="inline-flex h-10 items-center border border-[color:var(--line-strong)] px-6 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition sm:h-11 sm:px-8 sm:text-[11px] hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Назад ко всему каталогу
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
