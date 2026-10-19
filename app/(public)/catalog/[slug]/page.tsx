import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CatalogSidebar,
  CatalogToolbar,
} from "@/components/catalog/catalog-filters";
import { StructuredData } from "@/components/seo/structured-data";
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
import {
  getPublicCategories,
  getPublicCategoryBySlug,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";
import { getCurrentFavoriteProductSlugs } from "@/lib/server/favorites";
import { isPremiumStorefront } from "@/features/storefront/config";
import { StorefrontCatalog } from "@/features/storefront/catalog";
import {
  breadcrumbJsonLd,
  categorySeoDescription,
  categorySeoTitle,
  collectionJsonLd,
  createSeoMetadata,
} from "@/lib/seo";

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
    return createSeoMetadata({
      title: "Раздел каталога",
      description: "Каталог материалов Artisan.",
      path: "/catalog",
    });
  }

  return createSeoMetadata({
    title: categorySeoTitle(category),
    description: categorySeoDescription(category),
    path: `/catalog/${category.slug}`,
    images: category.coverImage ? [category.coverImage] : undefined,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [categoryProducts, favoriteSlugs] = await Promise.all([
    getPublicProductsByCategory(category.slug),
    getCurrentFavoriteProductSlugs(),
  ]);
  if (isPremiumStorefront())
    return (
      <StorefrontCatalog
        products={categoryProducts}
        categories={await getPublicCategories()}
        favorites={favoriteSlugs}
        searchParams={await searchParams}
        category={category}
      />
    );
  const parsedState = parseCatalogSearchParams(await searchParams);
  const availableFilterOptions = getCatalogFilterOptions(categoryProducts);
  const state = sanitizeCatalogFilterState(parsedState, availableFilterOptions);
  const filterOptions = getCatalogFacetOptions(categoryProducts, state);
  const filteredProducts = filterCatalogProducts(categoryProducts, state);
  const sortedProducts = sortCatalogProducts(filteredProducts, state.sort);
  const pagination = paginateCatalogProducts(sortedProducts, state.page);
  const resolvedState = { ...state, page: pagination.currentPage };
  const basePath = `/catalog/${category.slug}`;
  const currentHref = buildCatalogHref(basePath, resolvedState);

  return (
    <div className="bg-[var(--surface)]">
      <StructuredData
        data={[
          breadcrumbJsonLd([
            { name: "Главная", href: "/" },
            { name: "Каталог", href: "/catalog" },
            { name: category.name, href: basePath },
          ]),
          collectionJsonLd({
            name: category.name,
            description: categorySeoDescription(category),
            path: basePath,
            products: pagination.items,
          }),
        ]}
      />
      <section className="border-b border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1500px] space-y-2">
          <Breadcrumbs
            items={[
              { label: "Каталог", href: "/catalog" },
              { label: category.name },
            ]}
          />
          <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            {category.name}
          </h1>
        </div>
      </section>

      <section className="px-4 pt-2.5 pb-5 sm:px-8 sm:py-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] min-w-0 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
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
                      href={`/product/${product.slug}`}
                      brand={product.brand}
                      name={product.name}
                      summary={product.summary}
                      format={product.format}
                      action={product.action}
                      image={product.image}
                      price={product.price}
                      oldPrice={product.oldPrice}
                      sku={product.sku}
                      inStock={product.inStock}
                      purchaseMode={product.purchaseMode}
                      isBundle={product.isBundle}
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
                  className="mt-6 inline-flex h-10 items-center border border-[var(--foreground)] px-6 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:bg-[var(--foreground)] hover:text-[var(--background)] sm:mt-7 sm:h-11 sm:px-8 sm:text-[11px]"
                >
                  Сбросить фильтры
                </Link>
              </div>
            )}

            <Link
              href="/catalog"
              className="inline-flex h-10 items-center border border-[color:var(--line-strong)] px-6 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] sm:h-11 sm:px-8 sm:text-[11px]"
            >
              Назад ко всему каталогу
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
