import Image from "next/image";
import Link from "next/link";

import type { FeaturedProduct } from "@/features/catalog/data";
import { cn } from "@/lib/utils";

export type BrandGalleryItem = {
  slug: string;
  name: string;
  label: string;
  description: string;
  tone?: "active" | "planned";
  href?: string;
  products?: FeaturedProduct[];
  previewLabels?: string[];
  statusLabel?: string;
  tags?: string[];
};

type BrandGalleryProps = {
  items: BrandGalleryItem[];
  compact?: boolean;
};

function getPreviewProducts(products?: FeaturedProduct[]) {
  return (products ?? []).filter((product) => product.image).slice(0, 5);
}

function isPlannedTone(item: BrandGalleryItem) {
  return item.tone === "planned";
}

function PlaceholderVisual({
  item,
  compact,
}: {
  item: BrandGalleryItem;
  compact?: boolean;
}) {
  const planned = isPlannedTone(item);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        planned
          ? "border border-[#151411]/10 bg-[#e7e1d6] text-[#151411]"
          : "bg-[#151411] text-white",
        compact ? "min-h-[28svh] sm:min-h-[46svh] lg:min-h-[68svh]" : "min-h-[42svh]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          planned
            ? "bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.7),transparent_38%),linear-gradient(145deg,#f5f1ea_0%,#e7e1d6_58%,#d8d0c4_100%)]"
            : "bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(135deg,#302a22_0%,#151411_58%,#5d3324_100%)]",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 grid grid-cols-4",
          planned ? "opacity-50" : "opacity-16",
        )}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              "border-r",
              planned ? "border-[#151411]/10" : "border-white/30",
            )}
          />
        ))}
        <span />
      </div>
      <div className="relative flex min-h-[inherit] flex-col justify-end p-4 sm:p-7">
        <p
          className={cn(
            "font-mono text-[10px] tracking-[0.2em] uppercase",
            planned ? "text-[#151411]/44" : "text-white/56",
          )}
        >
          {planned ? "В подготовке" : "Каталог в подготовке"}
        </p>
        <h3
          className={cn(
            "mt-2.5 max-w-[18rem] text-[1.85rem] leading-[0.95] font-semibold tracking-[-0.055em] text-balance sm:mt-3 sm:text-[3rem]",
            planned ? "text-[#151411]" : "text-white",
          )}
        >
          {item.name}
        </h3>
        {planned ? (
          <p className="mt-2.5 max-w-[20rem] text-sm leading-5 text-[#151411]/62 sm:mt-3 sm:leading-6">
            Бренд уже добавлен в структуру сайта. Наполнение товарами и
            материалами появится следующим слоем.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BrandHero({
  item,
  compact,
}: {
  item: BrandGalleryItem;
  compact?: boolean;
}) {
  const heroProduct = getPreviewProducts(item.products)[0];
  const planned = isPlannedTone(item);

  if (!heroProduct) {
    return <PlaceholderVisual item={item} compact={compact} />;
  }

  const hero = (
    <div
      className={cn(
        "relative overflow-hidden bg-[#d8d3c9]",
        compact ? "min-h-[32svh] sm:min-h-[56svh] lg:min-h-[78svh]" : "min-h-[46svh]",
      )}
    >
      <Image
        src={heroProduct.image}
        alt={`${item.name}: ${heroProduct.name}`}
        fill
        className="object-cover transition duration-700 group-hover:scale-[1.025]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.16)_54%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 grid gap-4 p-3.5 text-white sm:gap-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-12">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/58 uppercase">
            {item.label}
          </p>
          <h3 className="mt-2.5 max-w-[32rem] text-[1.55rem] leading-[0.9] font-semibold tracking-[-0.055em] text-balance sm:mt-3 sm:text-[3rem] lg:text-[4.4rem]">
            {item.name}
          </h3>
        </div>
        {item.href ? (
          <span
            className={cn(
              "inline-flex h-11 w-fit items-center justify-center px-8 font-mono text-[11px] tracking-[0.16em] uppercase",
              planned
                ? "border border-white/24 bg-black/12 text-white/76"
                : "border border-white/46 text-white",
            )}
          >
            {planned ? "Скоро" : "Смотреть бренд"}
          </span>
        ) : null}
      </div>
    </div>
  );

  return item.href ? (
    <Link href={item.href} className="group block">
      {hero}
    </Link>
  ) : (
    hero
  );
}

function ProductRail({
  item,
  compact,
}: {
  item: BrandGalleryItem;
  compact?: boolean;
}) {
  const products = getPreviewProducts(item.products);
  const planned = isPlannedTone(item);

  if (products.length > 0) {
    return (
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-5 sm:px-0">
        <div
          className={cn(
            "grid min-w-max auto-cols-[9.25rem] grid-flow-col gap-3 sm:min-w-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 md:grid-cols-3 sm:gap-4",
            compact ? "xl:grid-cols-5" : "lg:grid-cols-5",
          )}
        >
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/product/${product.slug}`}
            className="group block"
          >
            <div
              className={cn(
                "relative aspect-[4/5.2] overflow-hidden",
                planned
                  ? "border border-[#151411]/8 bg-[#ebe6de]"
                  : "bg-[#e2ded6]",
              )}
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
                sizes={compact ? "(max-width: 1024px) 50vw, 25vw" : "20vw"}
              />
            </div>
            <p
              className={cn(
              "mt-2 text-[13px] leading-5 font-medium sm:mt-2.5 sm:text-sm",
                planned ? "text-[#151411]/74" : "text-[#151411]",
              )}
            >
              {product.name}
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-[10px] tracking-[0.14em] uppercase",
                planned ? "text-[#9a9389]" : "text-[#7b756d]",
              )}
            >
              {planned ? "Скоро в каталоге" : product.action}
            </p>
          </Link>
        ))}
        </div>
      </div>
    );
  }

  return (
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-5 sm:px-0">
      <div
        className={cn(
          "grid min-w-max auto-cols-[8.75rem] grid-flow-col gap-3 sm:min-w-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-3 sm:gap-4",
          compact ? "xl:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
      {(item.previewLabels ?? []).map((label) => (
        <div
          key={label}
          className={cn(
            "flex aspect-square items-end p-3.5 sm:p-4",
            planned
              ? "border border-dashed border-[#151411]/10 bg-[#f5f1ea]"
              : "bg-[#e2ded6]",
          )}
        >
          <span
            className={cn(
              "font-mono text-[10px] leading-5 tracking-[0.16em] uppercase",
              planned ? "text-[#9a9389]" : "text-[#7b756d]",
            )}
          >
            {label}
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}

function MetaRow({ item }: { item: BrandGalleryItem }) {
  const chips = [item.statusLabel, ...(item.tags ?? [])].filter(Boolean);
  const planned = isPlannedTone(item);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
      {chips.map((chip) => (
        <span
          key={chip}
          className={cn(
            "inline-flex min-h-8 items-center px-3 font-mono text-[10px] tracking-[0.14em] uppercase",
            planned
              ? "border border-[#151411]/8 bg-white/36 text-[#948c81]"
              : "border border-[#151411]/14 text-[#6b655e]",
          )}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

export function BrandGallery({ items, compact = false }: BrandGalleryProps) {
  return (
    <div className={compact ? "space-y-12" : "space-y-16"}>
      {items.map((item, index) => (
        <section
          key={item.slug}
          className={cn("view-rise", isPlannedTone(item) && "opacity-[0.96]")}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <BrandHero item={item} compact={compact} />
          <MetaRow item={item} />
          <ProductRail item={item} compact={compact} />
        </section>
      ))}
    </div>
  );
}
