import { ProductCard } from "@/components/ui/cards";
import type { FeaturedProduct } from "@/features/catalog/types";

export function SimilarByDecor({
  current,
  allProducts,
}: {
  current: FeaturedProduct;
  allProducts: FeaturedProduct[];
}) {
  if (!current.decorGroupSlug || !current.decorGroup) return null;

  const similar = allProducts
    .filter(
      (p) =>
        p.slug !== current.slug &&
        p.decorGroupSlug === current.decorGroupSlug,
    )
    .slice(0, 4);

  if (similar.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--line)] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex items-end justify-between gap-6 sm:mb-7">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Тот же декор
            </p>
            <h2 className="mt-2 text-[1.45rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.65rem]">
              {current.decorGroup}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Тот же декор в других брендах и форматах.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-9 xl:grid-cols-4">
          {similar.map((item) => (
            <ProductCard
              key={item.slug}
              slug={item.slug}
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
              purchaseMode={item.purchaseMode}
              hoverImage={item.gallery?.[0]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}