import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
  inStock?: boolean;
  categoryName?: string;
  compact?: boolean;
  denseMobile?: boolean;
  mobileList?: boolean;
  className?: string;
};

export function ProductCard({
  href,
  brand,
  name,
  summary,
  format,
  action,
  image,
  price,
  oldPrice,
  inStock = true,
  categoryName,
  compact = false,
  denseMobile = false,
  mobileList = false,
  className,
}: ProductCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full overflow-hidden bg-transparent transition duration-300",
        mobileList
          ? "flex-row items-start gap-3 border-b border-[color:var(--line)] pb-3.5 sm:flex-col sm:gap-0 sm:border-b-0 sm:pb-0"
          : "flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-[var(--background)]",
          mobileList && "w-[6.9rem] shrink-0 sm:w-full",
          compact
            ? "aspect-square"
            : denseMobile
              ? mobileList
                ? "aspect-[0.78] sm:aspect-[1.02]"
                : "aspect-[0.88] sm:aspect-[1.02]"
              : "aspect-[0.94] sm:aspect-[1.04]",
        )}
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
            sizes={
              mobileList
                ? "(max-width: 639px) 112px, (max-width: 1024px) 50vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            <span className="rounded-full border border-[color:var(--line)] px-4 py-2 text-xs tracking-[0.18em] uppercase">
              Artisan
            </span>
          </div>
        )}

        {categoryName ? (
          <span
            className={cn(
              "absolute bg-white/88 font-mono tracking-[0.14em] text-[var(--muted)] uppercase backdrop-blur-sm",
              mobileList && "hidden sm:inline-flex",
              compact || denseMobile
                ? "top-2 left-2 px-2 py-0.5 text-[8px] sm:top-3 sm:left-3 sm:px-3 sm:py-1 sm:text-[10px]"
                : "px-2.5 py-1 text-[9px] sm:px-3 sm:text-[10px]",
            )}
          >
            {categoryName}
          </span>
        ) : null}

        <span
          className={cn(
            "absolute font-mono tracking-[0.12em] uppercase backdrop-blur-sm",
            compact || denseMobile
              ? "top-2 right-2 px-2 py-0.5 text-[8px] sm:top-3 sm:right-3 sm:px-2 sm:py-1 sm:text-[10px]"
              : "px-2 py-1 text-[9px] sm:text-[10px]",
            mobileList && "top-2 right-2 sm:top-3 sm:right-3",
            inStock
              ? "bg-white/82 text-[var(--foreground)]"
              : "bg-[#151411]/82 text-white",
          )}
        >
          {inStock ? "В наличии" : "Под заказ"}
        </span>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          mobileList
            ? "min-h-[6.9rem] pt-0 sm:min-h-0 sm:pt-3"
            : compact
              ? "pt-3"
              : denseMobile
                ? "pt-2.5 sm:pt-4"
                : "pt-3.5 sm:pt-4",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "font-mono tracking-[0.22em] text-[var(--accent)] uppercase",
                mobileList
                  ? "text-[8px] sm:text-[11px]"
                  : denseMobile
                    ? "text-[9px] sm:text-[11px]"
                    : "text-[10px] sm:text-[11px]",
              )}
            >
              {brand}
            </p>

            {mobileList && categoryName ? (
              <p className="mt-1 font-mono text-[8px] tracking-[0.14em] text-[var(--muted)] uppercase sm:hidden">
                {categoryName}
              </p>
            ) : null}
          </div>

          {mobileList ? (
            <span className="shrink-0 font-mono text-[8px] tracking-[0.14em] text-[var(--muted)] uppercase sm:hidden">
              {format}
            </span>
          ) : null}
        </div>

        <h3
          className={cn(
            "mt-2 font-semibold text-[var(--foreground)]",
            compact
              ? "text-[14px] leading-5"
              : denseMobile
                ? "text-[13px] leading-[1.35] sm:text-base sm:leading-5"
                : "text-[15px] leading-5 sm:text-base",
            mobileList &&
              "mt-1.5 line-clamp-2 text-[14px] leading-[1.22] sm:mt-2 sm:text-base sm:leading-5",
          )}
        >
          {name}
        </h3>

        <p
          className={cn(
            "text-[var(--muted)]",
            mobileList
              ? "mt-1 hidden sm:block sm:text-sm sm:leading-5"
              : denseMobile
                ? "mt-1 line-clamp-1 text-[12px] leading-4 sm:mt-1.5 sm:line-clamp-2 sm:text-sm sm:leading-5"
                : "mt-1 line-clamp-2 text-[13px] leading-5 sm:mt-1.5 sm:text-sm",
          )}
        >
          {summary}
        </p>

        <div
          className={cn(
            "mt-auto",
            mobileList
              ? "pt-2 sm:pt-4"
              : compact
                ? "pt-2.5"
                : denseMobile
                  ? "pt-2.5 sm:pt-4"
                  : "pt-3 sm:pt-4",
          )}
        >
          <div
            className={cn(
              "flex items-end justify-between gap-3",
              mobileList
                ? "pt-0 sm:pt-4"
                : compact
                  ? "pt-2.5"
                  : denseMobile
                    ? "pt-2 sm:pt-4"
                    : "pt-3 sm:pt-4",
            )}
          >
            <div>
              {price ? (
                <p
                  className={cn(
                    "font-semibold text-[var(--foreground)]",
                    compact
                      ? "text-[15px]"
                      : denseMobile
                        ? "text-[14px] sm:text-lg"
                        : "text-[15px] sm:text-lg",
                    mobileList && "text-[13px] sm:text-lg",
                  )}
                >
                  {formatPrice(price)}
                </p>
              ) : null}

              {oldPrice ? (
                <p className="text-xs text-[var(--muted)] line-through">
                  {formatPrice(oldPrice)}
                </p>
              ) : null}

              {!price ? (
                <p
                  className={cn(
                    "font-semibold text-[var(--foreground)]",
                    compact
                      ? "text-[12px]"
                      : denseMobile
                        ? "text-[11px] sm:text-sm"
                        : "text-[12px] sm:text-sm",
                    mobileList && "text-[10px] leading-4 sm:text-sm",
                  )}
                >
                  {action}
                </p>
              ) : null}
            </div>

            <span
              className={cn(
                "text-[var(--muted)]",
                mobileList
                  ? "hidden sm:inline text-xs"
                  : compact || denseMobile
                    ? "text-[10px] sm:text-xs"
                    : "text-[11px] sm:text-xs",
              )}
            >
              {format}
            </span>
          </div>
        </div>
      </div>
    </Link>
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
