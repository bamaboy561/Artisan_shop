import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/ecommerce/add-to-cart-button";
import { FavoriteToggle } from "@/components/catalog/favorite-toggle";
import { StructuredData } from "@/components/seo/structured-data";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";
import { ProductCard } from "@/components/ui/cards";
import {
  getPublicCategoryBySlug,
  getPublicProductBySlug,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";
import { getCurrentFavoriteProductSlugs } from "@/lib/server/favorites";
import { formatPrice } from "@/lib/commerce";
import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";
import {
  breadcrumbJsonLd,
  createSeoMetadata,
  productJsonLd,
  productSeoDescription,
  productSeoTitle,
} from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

type RelatedProductCandidate = NonNullable<
  Awaited<ReturnType<typeof getPublicProductBySlug>>
>;

function getRelatedProductScore(
  product: RelatedProductCandidate,
  candidate: RelatedProductCandidate,
) {
  let score = 0;

  if (candidate.brandSlug && candidate.brandSlug === product.brandSlug) {
    score += 40;
  }

  if (
    candidate.decorGroupSlug &&
    product.decorGroupSlug &&
    candidate.decorGroupSlug === product.decorGroupSlug
  ) {
    score += 30;
  }

  if (
    candidate.sheetPresetId &&
    candidate.sheetPresetId === product.sheetPresetId
  ) {
    score += 12;
  }

  if (
    candidate.calculatorMaterialId &&
    candidate.calculatorMaterialId === product.calculatorMaterialId
  ) {
    score += 10;
  }

  if (candidate.format && candidate.format === product.format) {
    score += 8;
  }

  if (candidate.purchaseMode === product.purchaseMode) {
    score += 4;
  }

  return score;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    return createSeoMetadata({
      title: "Товар не найден",
      description: "Карточка товара Artisan не найдена.",
      path: "/catalog",
    });
  }

  return createSeoMetadata({
    title: productSeoTitle(product),
    description: productSeoDescription(product),
    path: `/product/${product.slug}`,
    images: product.gallery.length > 0 ? product.gallery : [product.image],
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [category, sameCategoryProducts, favoriteSlugs] = await Promise.all([
    getPublicCategoryBySlug(product.categorySlug),
    getPublicProductsByCategory(product.categorySlug),
    getCurrentFavoriteProductSlugs(),
  ]);
  const categoryHref = category ? `/catalog/${category.slug}` : "/catalog";
  const relatedProducts = sameCategoryProducts
    .filter((item) => item.slug !== product.slug)
    .map((item) => ({
      item,
      score: getRelatedProductScore(product, item),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.name.localeCompare(right.item.name, "ru", {
        sensitivity: "base",
      });
    })
    .map(({ item }) => item)
    .slice(0, 4);
  const gallery =
    product.gallery.length > 0 ? product.gallery : [product.image];
  const availabilityLabel = product.inStock ? "В наличии" : "По запросу";
  const duplicatedSpecKeys = new Set(["артикул", "бренд", "раздел", "формат"]);
  const specificationRows = [
    { key: "Артикул", value: product.sku },
    { key: "Бренд", value: product.brand },
    { key: "Раздел", value: product.categoryName },
    { key: "Формат", value: product.format },
    ...product.specifications.filter(
      (specification) =>
        !duplicatedSpecKeys.has(specification.key.trim().toLowerCase()),
    ),
    { key: "Сценарий заказа", value: product.action },
  ];

  return (
    <div className="bg-[#f1eee8]">
      <StructuredData
        data={[
          breadcrumbJsonLd([
            { name: "Главная", href: "/" },
            { name: "Каталог", href: "/catalog" },
            ...(category ? [{ name: category.name, href: categoryHref }] : []),
            { name: product.name, href: `/product/${product.slug}` },
          ]),
          productJsonLd(product),
        ]}
      />
      <div className="border-b border-[color:var(--line)] px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <Breadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Каталог", href: "/catalog" },
              ...(category
                ? [{ label: category.name, href: categoryHref }]
                : []),
              { label: product.name },
            ]}
          />
        </div>
      </div>

      <section className="px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:gap-8">
          <div className="min-w-0 space-y-3 sm:space-y-4">
            <div className="relative aspect-[0.95] overflow-hidden bg-[#dad7cf] sm:aspect-[0.86]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 58vw"
                unoptimized={shouldBypassNextImageOptimization(product.image)}
              />
            </div>

            {gallery.length > 1 ? (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div className="grid w-max grid-flow-col gap-3 sm:w-auto sm:grid-flow-row sm:grid-cols-2">
                  {gallery.slice(1, 5).map((image, index) => (
                    <div
                      key={`${product.slug}-gallery-${index}`}
                      className="relative aspect-square w-[8.25rem] overflow-hidden bg-[#dad7cf] sm:w-auto"
                    >
                      <Image
                        src={image}
                        alt={`${product.name} - изображение ${index + 2}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 40vw, 28vw"
                        unoptimized={shouldBypassNextImageOptimization(image)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <div className="min-w-0 border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 sm:p-6 lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  {product.brand}
                </p>
                <FavoriteToggle
                  productSlug={product.slug}
                  isFavorite={favoriteSlugs.has(product.slug)}
                  next={`/product/${product.slug}`}
                  variant="product"
                />
              </div>
              <h1 className="mt-3 text-[1.8rem] leading-[0.98] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.4rem]">
                {product.name}
              </h1>
              <p className="mt-3 text-sm leading-5 text-[var(--muted)] sm:mt-4 sm:leading-6">
                {product.summary}
              </p>

              <div className="mt-5 border-y border-[color:var(--line)] py-4 sm:mt-7 sm:py-5">
                {typeof product.price === "number" ? (
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                      Цена
                    </p>
                    <p className="mt-2 text-[1.6rem] font-semibold text-[var(--foreground)] sm:text-2xl">
                      {formatPrice(product.price)}
                    </p>
                    {product.oldPrice ? (
                      <p className="mt-1 text-sm text-[var(--muted)] line-through">
                        {formatPrice(product.oldPrice)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                      Формат заказа
                    </p>
                    <p className="mt-2 text-[1.45rem] font-semibold text-[var(--foreground)] sm:text-2xl">
                      {product.action}
                    </p>
                  </div>
                )}
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:mt-5">
                <div className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-4 border-b border-[color:var(--line)] pb-3">
                  <dt className="text-[var(--muted)]">Артикул</dt>
                  <dd className="min-w-0 text-right font-medium break-words text-[var(--foreground)]">
                    {product.sku}
                  </dd>
                </div>
                <div className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-4 border-b border-[color:var(--line)] pb-3">
                  <dt className="text-[var(--muted)]">Формат</dt>
                  <dd className="min-w-0 text-right font-medium break-words text-[var(--foreground)]">
                    {product.format}
                  </dd>
                </div>
                <div className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-4 border-b border-[color:var(--line)] pb-3">
                  <dt className="text-[var(--muted)]">Наличие</dt>
                  <dd className="min-w-0 text-right font-medium break-words text-[var(--foreground)]">
                    {availabilityLabel}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 grid gap-2.5 sm:mt-7 sm:gap-3">
                {product.purchaseMode === "cart" &&
                typeof product.price === "number" ? (
                  <>
                    <AddToCartButton
                      productSlug={product.slug}
                      disabled={!product.inStock}
                      className="w-full"
                    />
                    <ButtonLink
                      href="/contacts"
                      variant="secondary"
                      className="w-full"
                    >
                      Связаться с менеджером
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink
                      href="/contacts"
                      variant="contrast"
                      className="w-full"
                    >
                      Запросить цену
                    </ButtonLink>
                    <ButtonLink
                      href={`/calculator?product=${encodeURIComponent(product.slug)}`}
                      variant="secondary"
                      className="w-full"
                    >
                      Нужен распил
                    </ButtonLink>
                    <ButtonLink
                      href={categoryHref}
                      variant="secondary"
                      className="w-full"
                    >
                      Вернуться в раздел
                    </ButtonLink>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-[color:var(--line)] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Характеристики
              </p>
              <h2 className="mt-2 text-[1.45rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.65rem]">
                Характеристики
              </h2>
            </div>
            <Link
              href={categoryHref}
              className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase transition hover:text-[var(--foreground)]"
            >
              Смотреть раздел
            </Link>
          </div>

          <div className="border border-[color:var(--line)] bg-[var(--surface-strong)]">
            {specificationRows.map((row, index) => (
              <div
                key={`${row.key}-${index}`}
                className="grid min-w-0 gap-1.5 border-b border-[color:var(--line)] px-4 py-3.5 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-2 sm:px-5 sm:py-4"
              >
                <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                  {row.key}
                </p>
                <p className="min-w-0 text-sm leading-5 break-words text-[var(--foreground)] sm:leading-6">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="border-t border-[color:var(--line)] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-5 flex items-end justify-between gap-6 sm:mb-7">
              <div>
                <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  Похожие
                </p>
                <h2 className="mt-2 text-[1.45rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.65rem]">
                  Похожие материалы
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-9 xl:grid-cols-4">
              {relatedProducts.map((item) => (
                <ProductCard
                  key={item.slug}
                  href={`/product/${item.slug}`}
                  brand={item.brand}
                  name={item.name}
                  summary={item.summary}
                  format={item.format}
                  action={item.action}
                  image={item.image}
                  price={item.price}
                  oldPrice={item.oldPrice}
                  inStock={item.inStock}
                  categoryName={item.categoryName}
                  productSlug={item.slug}
                  isFavorite={favoriteSlugs.has(item.slug)}
                  favoriteNext={`/product/${product.slug}`}
                  showFavorite
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
