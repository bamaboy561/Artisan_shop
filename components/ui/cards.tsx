import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FavoriteToggle } from "@/components/catalog/favorite-toggle";
import { AddToCartButton } from "@/components/ecommerce/add-to-cart-button";
import { ProductImage } from "@/components/catalog/product-image";
import { formatPrice } from "@/lib/commerce";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  href: string;
  brand: string;
  name: string;
  summary: string;
  format: string;
  action: string;
  image?: string;
  price?: number;
  oldPrice?: number;
  sku?: string;
  inStock?: boolean;
  categoryName?: string;
  purchaseMode?: "cart" | "request";
  compact?: boolean;
  denseMobile?: boolean;
  mobileList?: boolean;
  productSlug?: string;
  isFavorite?: boolean;
  isBundle?: boolean;
  favoriteNext?: string;
  showFavorite?: boolean;
  className?: string;
};

export function ProductCard({
  href,
  brand,
  name,
  format,
  action,
  image,
  price,
  oldPrice,
  sku,
  inStock = true,
  purchaseMode = "request",
  compact = false,
  denseMobile = false,
  mobileList = false,
  productSlug,
  isFavorite = false,
  isBundle = false,
  favoriteNext = href,
  showFavorite = false,
  className,
}: ProductCardProps) {
  const aspect = compact
    ? "aspect-[1.04]"
    : denseMobile
      ? mobileList
        ? "aspect-[0.78] sm:aspect-[1.06]"
        : "aspect-[0.92] sm:aspect-[1.06]"
      : "aspect-[0.96] sm:aspect-[1.08]";
  const canAddToCart =
    Boolean(productSlug) &&
    purchaseMode === "cart" &&
    typeof price === "number";

  if (mobileList) {
    return (
      <article
        className={cn(
          "relative flex h-full min-w-0 flex-col border-b border-[color:var(--line)] pb-4 sm:border-b-0",
          className,
        )}
      >
        <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 sm:flex sm:flex-1 sm:flex-col sm:gap-0">
          <div className="relative self-start sm:w-full">
            <Link
              href={href}
              className="group relative block aspect-square w-24 overflow-hidden rounded bg-white sm:aspect-[4/3] sm:w-full"
            >
              <ProductImage
                src={image}
                alt={name}
                fill
                fallbackLabel="Artisan"
                className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 639px) 96px, (max-width: 1024px) 50vw, 25vw"
              />
            </Link>
            {productSlug && showFavorite ? (
              <div className="absolute top-1 left-1 z-10 sm:top-2 sm:right-2 sm:left-auto">
                <FavoriteToggle
                  productSlug={productSlug}
                  isFavorite={isFavorite}
                  next={favoriteNext}
                />
              </div>
            ) : null}
            {isBundle ? (
              <span className="mt-1 block text-xs text-[var(--muted)] sm:absolute sm:bottom-2 sm:left-2 sm:bg-white sm:px-2 sm:py-1">
                Комплект
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 sm:pt-3">
            <p className="text-xs text-[var(--muted)]">{brand}</p>
            <h3 className="mt-1 text-sm leading-5 font-medium break-words text-[var(--foreground)] sm:text-base sm:leading-6">
              <Link href={href} className="hover:text-[var(--accent)]">
                {name}
              </Link>
            </h3>
            {sku ? (
              <p className="mt-1.5 text-xs leading-5 [overflow-wrap:anywhere] text-[var(--muted)]">
                Артикул: {sku}
              </p>
            ) : null}
            {format ? (
              <p className="mt-1 text-xs leading-5 [overflow-wrap:anywhere] text-[var(--muted)]">
                {format}
              </p>
            ) : null}
            <p
              className={cn(
                "mt-1.5 text-xs",
                inStock ? "text-emerald-700" : "text-[var(--muted)]",
              )}
            >
              {inStock ? "В наличии" : "Под заказ"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold break-words text-[var(--foreground)]">
              {typeof price === "number" ? formatPrice(price) : action}
            </p>
            {typeof oldPrice === "number" &&
            typeof price === "number" &&
            oldPrice > price ? (
              <p className="text-xs text-[var(--muted)] line-through">
                {formatPrice(oldPrice)}
              </p>
            ) : null}
          </div>
          {canAddToCart && productSlug ? (
            <AddToCartButton
              productSlug={productSlug}
              disabled={!inStock}
              className="min-w-[130px]"
            />
          ) : (
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--foreground)]"
            >
              Подробнее
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={cn("relative h-full", className)}>
      {productSlug && (showFavorite || canAddToCart) ? (
        <div className="absolute top-2 right-2 z-20 grid gap-2 sm:top-3 sm:right-3">
          {showFavorite ? (
            <FavoriteToggle
              productSlug={productSlug}
              isFavorite={isFavorite}
              next={favoriteNext}
            />
          ) : null}
          {canAddToCart ? (
            <AddToCartButton
              productSlug={productSlug}
              disabled={!inStock}
              compact
            />
          ) : null}
        </div>
      ) : null}

      <Link
        href={href}
        className={cn(
          "group relative flex h-full overflow-hidden bg-transparent",
          mobileList
            ? "flex-row items-start gap-3.5 border-b border-[color:var(--line)] pb-4 sm:flex-col sm:gap-0 sm:border-b-0 sm:pb-0"
            : "flex-col",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden bg-[#ece8df]",
            mobileList && "w-[7rem] shrink-0 sm:w-full",
            aspect,
          )}
        >
          <ProductImage
            src={image}
            alt={name}
            fill
            fallbackLabel="Artisan"
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
            sizes={
              mobileList
                ? "(max-width: 639px) 112px, (max-width: 1024px) 50vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            }
          />

          {isBundle ? (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center bg-white/92 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--foreground)] uppercase backdrop-blur-sm sm:top-3 sm:left-3 sm:text-[10px]">
              Комплект
            </span>
          ) : null}

          {!inStock ? (
            <span
              className={cn(
                "absolute left-2.5 inline-flex items-center gap-1.5 bg-white/92 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--foreground)] uppercase backdrop-blur-sm sm:left-3 sm:text-[10px]",
                isBundle ? "top-10 sm:top-11" : "top-2.5 sm:top-3",
              )}
            >
              <span className="size-1 rounded-full bg-[var(--foreground)]/40" />
              Под заказ
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            mobileList
              ? "min-h-[7rem] pt-0 sm:min-h-0 sm:pt-3.5"
              : compact
                ? "pt-3"
                : "pt-3 sm:pt-4",
          )}
        >
          <p
            className={cn(
              "font-mono tracking-[0.22em] text-[var(--muted)] uppercase",
              mobileList
                ? "text-[9px] sm:text-[10px]"
                : "text-[10px] sm:text-[11px]",
            )}
          >
            {brand}
          </p>

          <h3
            className={cn(
              "mt-1.5 font-medium tracking-[-0.01em] text-[var(--foreground)] transition-colors duration-300 group-hover:text-[#9d573d]",
              compact
                ? "text-[15px] leading-[1.3]"
                : denseMobile
                  ? "text-[14px] leading-[1.3] sm:text-[17px] sm:leading-[1.25]"
                  : "text-[15px] leading-[1.3] sm:text-[17px] sm:leading-[1.25]",
              mobileList && "line-clamp-2 sm:line-clamp-1",
            )}
          >
            {name}
          </h3>

          {sku ? (
            <p
              className={cn(
                "mt-2 font-mono leading-4 tracking-[0.1em] [overflow-wrap:anywhere] text-[var(--muted)] uppercase",
                compact ? "text-[9px]" : "text-[9px] sm:text-[10px]",
              )}
            >
              SKU: {sku}
            </p>
          ) : null}

          <div
            className={cn(
              "mt-auto grid min-w-0 gap-1.5",
              mobileList ? "pt-2.5 sm:pt-3.5" : "pt-3 sm:pt-4",
            )}
          >
            <div className="min-w-0">
              {price ? (
                <>
                  <p
                    className={cn(
                      "font-semibold text-[var(--foreground)]",
                      compact ? "text-[15px]" : "text-[15px] sm:text-[17px]",
                    )}
                  >
                    {formatPrice(price)}
                  </p>
                  {oldPrice ? (
                    <p className="text-[11px] text-[var(--muted)] line-through sm:text-xs">
                      {formatPrice(oldPrice)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p
                  className={cn(
                    "font-medium text-[var(--foreground)]",
                    compact ? "text-[12px]" : "text-[12px] sm:text-[13px]",
                  )}
                >
                  {action}
                </p>
              )}
            </div>

            <span
              className={cn(
                "block max-w-full font-mono leading-4 tracking-[0.12em] [overflow-wrap:anywhere] text-[var(--muted)] uppercase",
                compact ? "text-[9px]" : "text-[9px] sm:text-[10px]",
              )}
            >
              {format}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

type CategoryCardProps = {
  href: string;
  indicator: string;
  name: string;
  summary: string;
  scenario: string;
  className?: string;
};

export function CategoryCard({
  href,
  indicator,
  name,
  summary,
  scenario,
  className,
}: CategoryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full min-h-[180px] flex-col overflow-hidden border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 transition duration-300 hover:border-[color:var(--foreground)] sm:min-h-[220px] sm:p-6",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--accent)] uppercase">
        {indicator}
      </p>
      <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
        {name}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{summary}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        {scenario}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

type ServiceCardProps = {
  name: string;
  detail: string;
  className?: string;
};

export function ServiceCard({ name, detail, className }: ServiceCardProps) {
  return (
    <article
      className={cn(
        "flex min-h-[180px] flex-col border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 transition duration-300 hover:border-[color:var(--foreground)] sm:min-h-[220px] sm:p-6",
        className,
      )}
    >
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{name}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </article>
  );
}

type BrandCardProps = {
  brand: string;
  className?: string;
};

export function BrandCard({ brand, className }: BrandCardProps) {
  return (
    <article
      className={cn(
        "flex min-h-[180px] flex-col border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 transition duration-300 hover:border-[color:var(--foreground)] sm:min-h-[220px] sm:p-6",
        className,
      )}
    >
      <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--accent)] uppercase">
        Партнерский бренд
      </p>
      <h3 className="mt-3 text-base font-semibold text-[var(--foreground)]">
        {brand}
      </h3>
    </article>
  );
}
