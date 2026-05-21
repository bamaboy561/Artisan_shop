"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

import { AddToCartButton } from "@/components/ecommerce/add-to-cart-button";
import { FavoriteButton } from "@/components/account/favorite-button";
import { ShareButton } from "@/components/ui/share-button";
import { formatPrice } from "@/lib/commerce";
import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";


type QuickViewProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  summary: string;
  sku: string;
  format: string;
  categoryName: string;
  inStock: boolean;
  price?: number;
  oldPrice?: number;
  purchaseMode: "cart" | "request";
  action?: string;
};

export function QuickViewButton({
  slug,
  name,
  brand,
  image,
  summary,
  sku,
  format,
  categoryName,
  inStock,
  price,
  oldPrice,
  purchaseMode,
  action,
  className,
}: QuickViewProduct & { className?: string; action?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`font-mono text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase transition hover:text-[var(--foreground)] ${className ?? ""}`}
      >
        Быстрый просмотр
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-modal-in relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-[28px] border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[0_32px_80px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full border border-[color:var(--line)] bg-white/90 p-2 text-[var(--muted)] transition hover:bg-[var(--foreground)] hover:text-white"
            >
              <X className="size-4" />
            </button>

            <div className="relative aspect-[1.4] overflow-hidden bg-[#dad7cf]">
              <Image
                src={image}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 600px"
                unoptimized={shouldBypassNextImageOptimization(image)}
              />
            </div>

            <div className="p-5 sm:p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                {brand}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {summary}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-[color:var(--line)] py-4 text-sm">
                <div>
                  <span className="text-[var(--muted)]">Артикул</span>
                  <p className="font-medium text-[var(--foreground)]">{sku}</p>
                </div>
                <div>
                  <span className="text-[var(--muted)]">Формат</span>
                  <p className="font-medium text-[var(--foreground)]">{format || "—"}</p>
                </div>
                <div>
                  <span className="text-[var(--muted)]">Раздел</span>
                  <p className="font-medium text-[var(--foreground)]">{categoryName}</p>
                </div>
                <div>
                  <span className="text-[var(--muted)]">Наличие</span>
                  <p className="font-medium text-[var(--foreground)]">{inStock ? "В наличии" : "По запросу"}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  {typeof price === "number" ? (
                    <>
                      <p className="text-2xl font-semibold text-[var(--foreground)]">
                        {formatPrice(price)}
                      </p>
                      {oldPrice ? (
                        <p className="text-sm text-[var(--muted)] line-through">
                          {formatPrice(oldPrice)}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-[var(--foreground)]">По запросу</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {purchaseMode === "cart" && typeof price === "number" ? (
                    <AddToCartButton productSlug={slug} disabled={!inStock} />
                  ) : null}
                  <FavoriteButton productSlug={slug} />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <ShareButton title={name} url={`/product/${slug}`} />
                <Link
                  href={`/product/${slug}`}
                  className="ml-auto font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:text-[var(--accent)]"
                >
                  Подробнее →
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}