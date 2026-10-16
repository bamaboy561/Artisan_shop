import Link from "next/link";
import { ArrowUpRight, Scissors } from "lucide-react";
import { StructuredData } from "@/components/seo/structured-data";
import { Pagination } from "@/components/ui/pagination";
import type {
  CatalogCategory,
  FeaturedProduct,
} from "@/features/catalog/types";
import { collectionJsonLd } from "@/lib/seo";
import { cuttingSiteIncentive } from "@/lib/site-config";
import { CatalogControls } from "./catalog-controls";
import { buildStorefrontHref, getStorefrontCatalog } from "./catalog-state";
import { StorefrontCard } from "./card";
import s from "./storefront.module.css";

export function StorefrontCatalog({
  products,
  categories,
  favorites,
  searchParams,
  category,
}: {
  products: FeaturedProduct[];
  categories: CatalogCategory[];
  favorites: Set<string>;
  searchParams: Record<string, string | string[] | undefined>;
  category?: CatalogCategory;
}) {
  const { state, options, thicknesses, pagination } = getStorefrontCatalog(
    products,
    searchParams,
  );
  const basePath = category ? `/catalog/${category.slug}` : "/catalog";
  const currentHref = buildStorefrontHref(basePath, state);
  const title = category?.name ?? "Каталог";
  const cutOffer = cuttingSiteIncentive?.offers[0];
  const categoryCounts = new Map<string, number>();
  for (const product of products)
    categoryCounts.set(
      product.categorySlug,
      (categoryCounts.get(product.categorySlug) ?? 0) + 1,
    );
  return (
    <div className={`${s.container} ${s.catalogPage}`}>
      <StructuredData
        data={collectionJsonLd({
          name: `${title} Artisan`,
          description:
            category?.description ?? "Мебельные материалы и фурнитура Artisan",
          path: basePath,
          products: pagination.items,
        })}
      />
      <nav className={s.breadcrumbs} aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>/</span>
        {category ? (
          <>
            <Link href="/catalog">Каталог</Link>
            <span>/</span>
            <span>{title}</span>
          </>
        ) : (
          <span>Каталог</span>
        )}
      </nav>
      <div className={s.catalogHeading}>
        <div>
          <h1>
            {title}
            <span className={s.headingCount}>{pagination.totalItems}</span>
          </h1>
          <p className={s.catalogLead}>
            {category?.summary ||
              "ЛДСП, МДФ, панели и фурнитура со склада в Бишкеке"}
          </p>
        </div>
        <Link href="/calculator" className={s.cutPill}>
          <Scissors size={17} />
          {cutOffer
            ? `Распил ${cutOffer.now} ${cutOffer.unit}`
            : "Рассчитать распил"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <nav className={s.categoryRail} aria-label="Разделы каталога">
        <Link href="/catalog" aria-current={category ? undefined : "page"}>
          Все материалы
          {!category && <span>{products.length}</span>}
        </Link>
        {categories.map((item) => (
          <Link
            key={item.slug}
            href={`/catalog/${item.slug}`}
            aria-current={category?.slug === item.slug ? "page" : undefined}
          >
            {item.name}
            {!category && categoryCounts.has(item.slug) && (
              <span>{categoryCounts.get(item.slug)}</span>
            )}
          </Link>
        ))}
      </nav>
      <CatalogControls
        state={state}
        options={options}
        thicknesses={thicknesses}
        basePath={basePath}
        count={pagination.totalItems}
      >
        {pagination.items.length > 0 ? (
          <>
            <div className={s.catalogProducts}>
              {pagination.items.map((product, index) => (
                <StorefrontCard
                  key={product.slug}
                  product={product}
                  eager={index < 4}
                  isFavorite={favorites.has(product.slug)}
                  next={currentHref}
                />
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <div className={s.pagination}>
                <p>
                  Страница {pagination.currentPage} из {pagination.totalPages}
                </p>
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  getHref={(page) =>
                    buildStorefrontHref(basePath, { ...state, page })
                  }
                />
              </div>
            )}
          </>
        ) : (
          <div className={s.empty}>
            <h2>
              {products.length
                ? "Ничего не найдено"
                : "Не удалось загрузить товары"}
            </h2>
            <p>
              {products.length
                ? "Попробуйте другой артикул или измените фильтры."
                : "Попробуйте обновить страницу или свяжитесь с менеджером."}
            </p>
            <Link
              href={products.length ? basePath : "/contacts"}
              className={s.primaryButton}
            >
              {products.length ? "Сбросить фильтры" : "Связаться с менеджером"}
            </Link>
          </div>
        )}
      </CatalogControls>
    </div>
  );
}
