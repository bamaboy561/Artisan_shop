import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";

import { ProductImage } from "@/components/catalog/product-image";
import { StructuredData } from "@/components/seo/structured-data";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";
import {
  getBrandProfileBySlug,
  getBrandProfiles,
  type BrandProfile,
} from "@/features/brands/data";
import type { FeaturedProduct } from "@/features/catalog/data";
import { formatPrice } from "@/lib/commerce";
import { companyName } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import {
  breadcrumbJsonLd,
  brandSeoDescription,
  brandSeoTitle,
  collectionJsonLd,
  createSeoMetadata,
} from "@/lib/seo";

type BrandPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const profiles = await getBrandProfiles();
  return profiles.map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandProfileBySlug(slug);

  if (!brand) {
    return {
      title: `Бренды | ${companyName}`,
    };
  }

  return createSeoMetadata({
    title: brandSeoTitle(brand),
    description: brandSeoDescription(brand),
    path: `/brands/${brand.slug}`,
    images: brand.logoUrl
      ? [brand.logoUrl]
      : brand.products[0]?.image
        ? [brand.products[0].image]
        : undefined,
  });
}

function getBrandMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function BrandLogo({
  brand,
  mode = "light",
}: {
  brand: BrandProfile;
  mode?: "light" | "dark";
}) {
  if (brand.logoUrl) {
    return (
      <div
        className="h-full min-h-[8rem] w-full rounded-[28px] border border-[#151411]/10 bg-white bg-contain bg-center bg-no-repeat shadow-[0_24px_70px_rgba(21,20,17,0.09)] sm:min-h-[10rem] lg:min-h-[13rem]"
        style={{ backgroundImage: `url(${brand.logoUrl})` }}
        aria-label={`Логотип ${brand.name}`}
      />
    );
  }

  return (
    <div
      className={`flex min-h-[8rem] items-center justify-center rounded-[28px] border text-[4.5rem] leading-none font-semibold tracking-[-0.08em] sm:min-h-[10rem] sm:text-[6rem] lg:min-h-[13rem] lg:text-[8rem] ${
        mode === "dark"
          ? "border-white/12 bg-white/8 text-white"
          : "border-[#151411]/10 bg-white text-[#151411]"
      }`}
      aria-label={`Логотип ${brand.name}`}
    >
      {getBrandMonogram(brand.name)}
    </div>
  );
}

function ProductVisual({
  product,
  priority = false,
  className = "",
}: {
  product?: FeaturedProduct;
  priority?: boolean;
  className?: string;
}) {
  if (!product?.image) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-[radial-gradient(circle_at_28%_16%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,#eee9df,#d8d0c3)]",
          className,
        )}
      >
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(90deg,#151411_1px,transparent_1px),linear-gradient(#151411_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[#e6e0d5]", className)}>
      <ProductImage
        src={product.image}
        alt={product.name}
        fill
        priority={priority}
        className="object-cover transition duration-700 group-hover:scale-[1.035]"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
    </div>
  );
}

function BrandHeroVisual({
  brand,
  products,
}: {
  brand: BrandProfile;
  products: FeaturedProduct[];
}) {
  const [heroProduct, secondProduct, thirdProduct] = products;

  return (
    <div className="grid min-h-[27rem] gap-3 bg-[#151411] p-3 text-white sm:min-h-[34rem] lg:min-h-[42rem] lg:grid-cols-[1.2fr_0.8fr]">
      <Link
        href={
          heroProduct ? `/product/${heroProduct.slug}` : brand.catalogHref ?? "/brands"
        }
        className="group relative min-h-[22rem] overflow-hidden lg:min-h-0"
      >
        <ProductVisual
          product={heroProduct}
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_28%,rgba(0,0,0,0.72)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/62 uppercase">
            {brand.sectionName}
          </p>
          <p className="mt-2 max-w-[24rem] text-2xl leading-[0.95] font-semibold tracking-[-0.05em] text-balance sm:text-4xl">
            {heroProduct?.name ?? brand.name}
          </p>
        </div>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Link
          href={
            secondProduct
              ? `/product/${secondProduct.slug}`
              : brand.catalogHref ?? "/brands"
          }
          className="group relative min-h-[12rem] overflow-hidden"
        >
          <ProductVisual product={secondProduct} className="absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,0.66)_100%)]" />
          <p className="absolute right-4 bottom-4 left-4 text-sm font-semibold text-white">
            {secondProduct?.name ?? brand.subcategories[0] ?? "Каталог"}
          </p>
        </Link>

        <div className="grid min-h-[12rem] overflow-hidden bg-[#f4efe6] text-[#151411]">
          {thirdProduct?.image ? (
            <Link href={`/product/${thirdProduct.slug}`} className="group grid">
              <ProductVisual product={thirdProduct} className="min-h-[12rem]" />
            </Link>
          ) : (
            <div className="grid content-between p-4 sm:p-5">
              <BrandLogo brand={brand} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewTiles({ labels }: { labels: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {labels.map((label) => (
        <div
          key={label}
          className="flex min-h-[12rem] items-end rounded-[26px] border border-[#151411]/8 bg-[linear-gradient(135deg,#f9f6ef,#dfd7ca)] p-4"
        >
          <span className="font-mono text-[10px] tracking-[0.16em] text-[#6f6962] uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProductEditorialCard({ product }: { product: FeaturedProduct }) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[0.92] overflow-hidden rounded-[28px] bg-[#e5dfd4]">
        {product.image ? (
          <ProductImage
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
              Artisan
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 min-w-0">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          {product.brand}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] leading-[1.25] font-medium tracking-[-0.02em] text-[var(--foreground)] transition group-hover:text-[var(--accent)] sm:text-base">
          {product.name}
        </h3>
        <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {product.price ? formatPrice(product.price) : product.action}
          </p>
          <span className="truncate font-mono text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase">
            {product.format}
          </span>
        </div>
      </div>
    </Link>
  );
}

function RelatedBrandCard({ brand }: { brand: BrandProfile }) {
  return (
    <Link
      href={brand.brandPageHref}
      className="group grid min-h-[17rem] content-between rounded-[30px] border border-[#151411]/10 bg-white/86 p-5 transition hover:-translate-y-1 hover:border-[#151411]/24 hover:bg-white hover:shadow-[0_24px_60px_rgba(21,20,17,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
            {brand.sectionName}
          </p>
          <h3 className="mt-3 text-2xl leading-none font-semibold tracking-[-0.055em] text-[#151411]">
            {brand.name}
          </h3>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#151411]/10 text-[#151411] transition group-hover:bg-[#151411] group-hover:text-white">
          <ArrowUpRight className="size-4" strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-8 line-clamp-3 text-sm leading-6 text-[#6a645d]">
        {brand.headline}
      </p>
    </Link>
  );
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brand = await getBrandProfileBySlug(slug);

  if (!brand) {
    notFound();
  }

  const previewProducts = brand.products.slice(0, 8);
  const heroProducts = brand.products.filter((product) => product.image).slice(0, 3);
  const allProfiles = await getBrandProfiles();
  const relatedBrands = allProfiles
    .filter(
      (candidate) =>
        candidate.sectionSlug === brand.sectionSlug &&
        candidate.slug !== brand.slug,
    )
    .slice(0, 3);
  const primaryHref = brand.catalogHref ?? "/contacts";
  const primaryLabel = brand.catalogHref
    ? "Открыть каталог"
    : "Запросить консультацию";
  const secondaryHref = brand.catalogHref ? "/services#service-request" : "/brands";
  const secondaryLabel = brand.catalogHref
    ? "Подобрать под проект"
    : "Все бренды";

  return (
    <div className="bg-[#f4f0e8] text-[#151411]">
      <StructuredData
        data={[
          breadcrumbJsonLd([
            { name: "Главная", href: "/" },
            { name: "Бренды", href: "/brands" },
            { name: brand.name, href: `/brands/${brand.slug}` },
          ]),
          collectionJsonLd({
            name: `${brand.name} в Artisan`,
            description: brand.overview,
            path: `/brands/${brand.slug}`,
            products: brand.products,
          }),
        ]}
      />

      <section className="px-4 pt-4 pb-8 sm:px-6 lg:px-8 lg:pt-6">
        <div className="mx-auto max-w-[1540px]">
          <div className="mb-4">
            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Бренды", href: "/brands" },
                { label: brand.name },
              ]}
            />
          </div>

          <div className="overflow-hidden rounded-[34px] border border-[#151411]/10 bg-[#fbf8f1] shadow-[0_28px_90px_rgba(21,20,17,0.08)]">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid min-h-[32rem] content-between gap-8 p-5 sm:p-8 lg:min-h-[42rem] lg:p-10 xl:p-12">
                <div className="grid gap-6">
                  <BrandLogo brand={brand} />

                  <div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {[brand.statusLabel, brand.sectionName, brand.country]
                        .filter(Boolean)
                        .map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex min-h-8 items-center rounded-full border border-[#151411]/10 bg-white/72 px-3 font-mono text-[10px] tracking-[0.13em] text-[#6f6962] uppercase"
                          >
                            {chip}
                          </span>
                        ))}
                    </div>

                    <h1 className="max-w-[11ch] text-[3.35rem] leading-[0.86] font-semibold tracking-[-0.075em] text-[#151411] sm:text-[5.2rem] lg:text-[6rem] xl:text-[7.2rem]">
                      {brand.name}
                    </h1>
                    <p className="mt-5 max-w-[36rem] text-base leading-7 text-[#5f5952] sm:text-lg sm:leading-8">
                      {brand.headline}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <p className="max-w-[40rem] text-sm leading-7 text-[#756f67]">
                    {brand.overview}
                  </p>
                  <div className="flex flex-col gap-2 sm:min-w-[14rem]">
                    <ButtonLink href={primaryHref} variant="contrast" icon>
                      {primaryLabel}
                    </ButtonLink>
                    <ButtonLink href={secondaryHref} variant="secondary">
                      {secondaryLabel}
                    </ButtonLink>
                  </div>
                </div>
              </div>

              <BrandHeroVisual brand={brand} products={heroProducts} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1540px] gap-4 lg:grid-cols-4">
          {[
            ["Позиции", brand.productCount > 0 ? `${brand.productCount}` : "Скоро"],
            ["Направление", brand.sectionName],
            ["Статус", brand.statusLabel],
            ["Сценарий", brand.catalogHref ? "Каталог" : "Консультация"],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-[26px] border border-[#151411]/10 bg-white/78 p-5"
            >
              <p className="font-mono text-[10px] tracking-[0.18em] text-[#8a837b] uppercase">
                {label}
              </p>
              <p className="mt-3 text-2xl leading-none font-semibold tracking-[-0.04em] text-[#151411]">
                {value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-[2.1rem] leading-[0.95] font-semibold tracking-[-0.06em] text-[#151411] sm:text-[3.4rem]">
                Что важно в {brand.name}.
              </h2>
              <p className="mt-4 max-w-[32rem] text-sm leading-7 text-[#6c665f]">
                Коротко о том, почему бренд стоит держать в подборке проекта и
                как его удобнее использовать в заказе.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {brand.strengths.map((strength) => (
                <article
                  key={strength}
                  className="rounded-[28px] border border-[#151411]/10 bg-white/84 p-5 shadow-[0_18px_50px_rgba(21,20,17,0.04)]"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#151411] text-white">
                    <Check className="size-4" strokeWidth={2} />
                  </span>
                  <p className="mt-7 text-lg leading-tight font-semibold tracking-[-0.035em] text-[#151411]">
                    {strength}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[2.2rem] leading-none font-semibold tracking-[-0.06em] text-[#151411] sm:text-[3.5rem]">
                Подборка бренда.
              </h2>
              <p className="mt-3 max-w-[34rem] text-sm leading-7 text-[#6c665f]">
                Самые заметные позиции бренда для быстрого перехода в карточку
                и запроса цены.
              </p>
            </div>
            {brand.catalogHref ? (
              <Link
                href={brand.catalogHref}
                className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[#151411] uppercase transition hover:text-[var(--accent)]"
              >
                Весь каталог
                <ChevronRight className="size-4" strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>

          {previewProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:gap-x-5">
              {previewProducts.map((product) => (
                <ProductEditorialCard key={product.slug} product={product} />
              ))}
            </div>
          ) : (
            <PreviewTiles labels={brand.previewLabels} />
          )}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px] overflow-hidden rounded-[34px] bg-[#151411] text-white">
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10 xl:p-12">
            <div>
              <h2 className="text-[2.2rem] leading-[0.94] font-semibold tracking-[-0.06em] text-white sm:text-[3.7rem]">
                Где используют {brand.name}.
              </h2>
              <p className="mt-4 max-w-[34rem] text-sm leading-7 text-white/58">
                Сценарии помогают менеджеру быстрее понять задачу клиента и
                предложить правильный формат заказа.
              </p>
            </div>

            <div className="grid gap-3">
              {brand.scenarios.map((scenario, index) => (
                <article
                  key={scenario}
                  className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.055] p-4 sm:grid-cols-[64px_minmax(0,1fr)] sm:p-5"
                >
                  <span className="font-mono text-[10px] tracking-[0.18em] text-white/38 uppercase">
                    0{index + 1}
                  </span>
                  <p className="text-base leading-7 text-white/86">
                    {scenario}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {relatedBrands.length > 0 ? (
        <section className="px-4 pt-6 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1540px]">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[2rem] leading-none font-semibold tracking-[-0.055em] text-[#151411] sm:text-[3rem]">
                  Бренды рядом.
                </h2>
                <p className="mt-3 max-w-[34rem] text-sm leading-7 text-[#6c665f]">
                  Другие направления Artisan, которые часто смотрят вместе с
                  этим брендом.
                </p>
              </div>
              <Link
                href="/brands"
                className="font-mono text-[10px] tracking-[0.16em] text-[#6c665f] uppercase transition hover:text-[#151411]"
              >
                Все бренды
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {relatedBrands.map((relatedBrand) => (
                <RelatedBrandCard
                  key={relatedBrand.slug}
                  brand={relatedBrand}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
