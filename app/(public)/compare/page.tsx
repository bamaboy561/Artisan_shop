import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";
import { formatPrice } from "@/lib/commerce";
import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";
import { createSeoMetadata } from "@/lib/seo";
import { getPublicProducts } from "@/lib/server/catalog-public";

export const metadata: Metadata = createSeoMetadata({
  title: "Сравнение материалов",
  description:
    "Сравните характеристики, цены и форматы материалов Artisan в одной таблице.",
  path: "/compare",
});

const MAX_COMPARE = 4;

function getSlugs(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  return joined
    .split(",")
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
    .slice(0, MAX_COMPARE);
}

function SpecRow({
  label,
  values,
}: {
  label: string;
  values: (string | number | null)[];
}) {
  const allSame = values.length > 1 && values.every((v) => v === values[0]);
  return (
    <tr className="border-b border-[var(--line)]">
      <td className="sticky left-0 z-10 bg-[var(--surface-strong)] px-3 py-3 font-mono text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase sm:px-5">
        {label}
      </td>
      {values.map((value, i) => (
        <td
          key={i}
          className={`px-3 py-3 text-sm sm:px-5 ${allSame ? "text-[var(--muted)]" : "font-medium text-[var(--foreground)]"}`}
        >
          {value ?? "\u2014"}
        </td>
      ))}
    </tr>
  );
}

type ComparePageProps = {
  searchParams: Promise<{ slugs?: string | string[] }>;
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { slugs: rawSlugs } = await searchParams;
  const slugs = getSlugs(rawSlugs);

  if (slugs.length < 2) {
    return (
      <div className="bg-[#f1eee8]">
        <div className="border-b border-[color:var(--line)] px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
          <div className="mx-auto max-w-[1500px]">
            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Каталог", href: "/catalog" },
                { label: "Сравнение" },
              ]}
            />
          </div>
        </div>
        <section className="px-4 py-16 text-center sm:px-8 lg:px-10">
          <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
            Сравнение
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-3xl">
            Выберите материалы для сравнения.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
            Откройте каталог, нажмите «Сравнить» на карточках товаров — и
            вернитесь сюда для side-by-side таблицы.
          </p>
          <div className="mt-7">
            <ButtonLink href="/catalog" variant="contrast">
              Перейти в каталог
            </ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  const allProducts = await getPublicProducts();
  const products = slugs
    .map((slug) => allProducts.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => p != null);

  if (products.length < 2) {
    return (
      <div className="bg-[#f1eee8]">
        <div className="border-b border-[color:var(--line)] px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
          <div className="mx-auto max-w-[1500px]">
            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Каталог", href: "/catalog" },
                { label: "Сравнение" },
              ]}
            />
          </div>
        </div>
        <section className="px-4 py-16 text-center sm:px-8 lg:px-10">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Недостаточно товаров для сравнения.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
            Некоторые товары могли быть скрыты или удалены. Вернитесь в каталог
            и выберите другие.
          </p>
          <div className="mt-7">
            <ButtonLink href="/catalog" variant="contrast">
              Перейти в каталог
            </ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  const allSpecKeys = new Set<string>();
  for (const product of products) {
    for (const spec of product.specifications) {
      allSpecKeys.add(spec.key);
    }
  }

  return (
    <div className="bg-[#f1eee8]">
      <div className="border-b border-[color:var(--line)] px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <Breadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Каталог", href: "/catalog" },
              { label: "Сравнение" },
            ]}
          />
        </div>
      </div>

      <section className="px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Сравнение
              </p>
              <h1 className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.8rem]">
                {products.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 && (
                      <span className="mx-2 text-[var(--muted)]">vs</span>
                    )}
                    {p.name}
                  </span>
                ))}
              </h1>
            </div>
            <Link
              href="/catalog"
              className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase transition hover:text-[var(--foreground)]"
            >
              + Добавить товар
            </Link>
          </div>

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--surface-strong)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="sticky left-0 z-10 w-36 bg-[var(--surface-strong)] px-3 py-2 sm:w-48 sm:px-5" />
                  {products.map((product) => (
                    <th
                      key={product.slug}
                      className="px-3 py-4 text-left align-top sm:px-5"
                    >
                      <div className="relative mb-3 aspect-square w-full max-w-[10rem] overflow-hidden bg-[#dad7cf]">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="160px"
                            unoptimized={shouldBypassNextImageOptimization(
                              product.image,
                            )}
                          />
                        ) : null}
                      </div>
                      <p className="font-mono text-[9px] tracking-[0.14em] text-[var(--accent)] uppercase">
                        {product.brand}
                      </p>
                      <Link
                        href={`/product/${product.slug}`}
                        className="mt-1 block text-[14px] font-semibold leading-tight text-[var(--foreground)] transition hover:text-[var(--accent)]"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                        {typeof product.price === "number"
                          ? formatPrice(product.price)
                          : "По запросу"}
                      </p>
                      {product.oldPrice ? (
                        <p className="text-sm text-[var(--muted)] line-through">
                          {formatPrice(product.oldPrice)}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <ButtonLink
                          href={`/product/${product.slug}`}
                          variant="secondary"
                          className="w-full text-xs"
                        >
                          К товару
                        </ButtonLink>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SpecRow label="Артикул" values={products.map((p) => p.sku)} />
                <SpecRow label="Бренд" values={products.map((p) => p.brand)} />
                <SpecRow label="Раздел" values={products.map((p) => p.categoryName)} />
                <SpecRow label="Формат" values={products.map((p) => p.format)} />
                <SpecRow
                  label="Цена"
                  values={products.map((p) =>
                    typeof p.price === "number" ? formatPrice(p.price) : "По запросу",
                  )}
                />
                <SpecRow
                  label="Наличие"
                  values={products.map((p) => (p.inStock ? "В наличии" : "По запросу"))}
                />
                <SpecRow label="Сценарий" values={products.map((p) => p.action)} />
                {[...allSpecKeys].map((key) => (
                  <SpecRow
                    key={key}
                    label={key}
                    values={products.map(
                      (p) => p.specifications.find((s) => s.key === key)?.value ?? null,
                    )}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}