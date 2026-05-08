import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";
import { ProductCard } from "@/components/ui/cards";
import {
  getBrandProfileBySlug,
  getBrandProfiles,
} from "@/features/brands/data";
import { companyName } from "@/lib/site-config";

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

  return {
    title: `${brand.name} | ${companyName}`,
    description: brand.overview,
  };
}

function PreviewTiles({ labels }: { labels: string[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {labels.map((label) => (
        <div
          key={label}
          className="flex min-h-[12rem] items-end bg-[#e1ddd4] p-4"
        >
          <span className="font-mono text-[10px] tracking-[0.16em] text-[#6f6962] uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brand = await getBrandProfileBySlug(slug);

  if (!brand) {
    notFound();
  }

  const heroImage = brand.products[0]?.image;
  const logoStyle = brand.logoUrl
    ? { backgroundImage: `url(${brand.logoUrl})` }
    : undefined;
  const previewProducts = brand.products.slice(0, 4);
  const allProfiles = await getBrandProfiles();
  const relatedBrands = allProfiles
    .filter(
      (candidate) =>
        candidate.sectionSlug === brand.sectionSlug &&
        candidate.slug !== brand.slug,
    )
    .slice(0, 3);

  return (
    <div className="bg-[#f1eee8]">
      <div className="border-b border-[color:var(--line)] px-5 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <Breadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Бренды", href: "/brands" },
              { label: brand.name },
            ]}
          />
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#151411] text-white">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={brand.name}
            fill
            priority
            className="object-cover opacity-30"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.16),transparent_26%),linear-gradient(135deg,#2f2922_0%,#151411_58%,#5b3427_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16)_0%,rgba(0,0,0,0.4)_48%,rgba(0,0,0,0.82)_100%)]" />

        <div className="relative mx-auto max-w-[1500px] px-5 pt-20 pb-10 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-end">
            <div className="max-w-[42rem]">
              {brand.logoUrl ? (
                <div
                  className="mb-6 h-14 w-36 rounded-2xl border border-white/20 bg-white/92 bg-contain bg-center bg-no-repeat shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
                  style={logoStyle}
                  aria-label={`Логотип ${brand.name}`}
                />
              ) : null}
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
                {brand.sectionName}
              </p>
              <h1 className="mt-3 text-[2.4rem] leading-[0.96] font-semibold tracking-[-0.05em] text-balance sm:text-[4rem]">
                {brand.name}
              </h1>
              <p className="mt-4 max-w-[32rem] text-[1rem] leading-7 text-white/84 sm:text-[1.1rem]">
                {brand.headline}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[brand.statusLabel, ...brand.subcategories].map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex min-h-8 items-center border border-white/16 px-3 font-mono text-[10px] tracking-[0.14em] text-white/72 uppercase"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="border border-white/12 bg-white/6 p-5 backdrop-blur-sm sm:p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-white/56 uppercase">
                Профиль
              </p>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-6 border-b border-white/10 pb-3">
                  <dt className="text-white/54">Статус</dt>
                  <dd className="text-right font-medium text-white">
                    {brand.statusLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-6 border-b border-white/10 pb-3">
                  <dt className="text-white/54">Направление</dt>
                  <dd className="text-right font-medium text-white">
                    {brand.sectionName}
                  </dd>
                </div>
                {brand.country ? (
                  <div className="flex justify-between gap-6 border-b border-white/10 pb-3">
                    <dt className="text-white/54">Страна</dt>
                    <dd className="text-right font-medium text-white">
                      {brand.country}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-6 pb-1">
                  <dt className="text-white/54">
                    {brand.productCount > 0 ? "Позиции" : "Раздел"}
                  </dt>
                  <dd className="text-right font-medium text-white">
                    {brand.productCount > 0
                      ? `${brand.productCount} в каталоге`
                      : "Готовится к наполнению"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 grid gap-3">
                <ButtonLink
                  href={brand.catalogHref ?? "/contacts"}
                  variant="contrast"
                >
                  {brand.catalogHref
                    ? "Открыть каталог бренда"
                    : "Запросить консультацию"}
                </ButtonLink>
                <ButtonLink
                  href={
                    brand.catalogHref ? "/services#service-request" : "/brands"
                  }
                  variant="secondary"
                >
                  {brand.catalogHref
                    ? "Подобрать под проект"
                    : "Вернуться к брендам"}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[0.74fr_1.26fr]">
          <article className="border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Главное
            </p>
            <h2 className="mt-3 text-[1.7rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {brand.name}
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {brand.strengths.map((strength) => (
                <span
                  key={strength}
                  className="inline-flex min-h-8 items-center border border-[#151411]/12 px-3 font-mono text-[10px] tracking-[0.14em] text-[#6f6962] uppercase"
                >
                  {strength}
                </span>
              ))}
            </div>
          </article>

          <article className="border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              {previewProducts.length > 0
                ? "Материалы"
                : "Раздел"}
            </p>
            <h2 className="mt-3 text-[1.7rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {previewProducts.length > 0
                ? "Подборка бренда."
                : "Раздел готовится."}
            </h2>

            {previewProducts.length > 0 ? (
              <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                {previewProducts.map((product) => (
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
                    compact
                  />
                ))}
              </div>
            ) : (
              <PreviewTiles labels={brand.previewLabels} />
            )}
          </article>
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-[var(--surface-strong)] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Применение
            </p>
            <h2 className="mt-3 text-[1.85rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Где используют {brand.name}.
            </h2>
          </div>

          <div className="grid gap-0 border border-[color:var(--line)]">
            {brand.scenarios.map((scenario, index) => (
              <div
                key={scenario}
                className="grid gap-4 border-b border-[color:var(--line)] bg-[#f1eee8] p-5 last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)]"
              >
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                  0{index + 1}
                </p>
                <p className="text-sm leading-7 text-[var(--foreground)]">
                  {scenario}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedBrands.length > 0 ? (
        <section className="px-5 py-10 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  Рядом
                </p>
                <h2 className="mt-2 text-[1.65rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  Бренды этого направления.
                </h2>
              </div>
              <Link
                href="/brands"
                className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase transition hover:text-[var(--foreground)]"
              >
                Все бренды
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {relatedBrands.map((relatedBrand) => (
                <Link
                  key={relatedBrand.slug}
                  href={relatedBrand.brandPageHref}
                  className="group border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 transition hover:border-[color:var(--foreground)]"
                >
                  <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                    {relatedBrand.sectionName}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                    {relatedBrand.name}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {relatedBrand.headline}
                  </p>
                  <p className="mt-5 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase transition group-hover:text-[var(--foreground)]">
                    {relatedBrand.statusLabel}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
