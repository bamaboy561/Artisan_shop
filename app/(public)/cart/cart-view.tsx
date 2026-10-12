"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { ProductImage } from "@/components/catalog/product-image";
import {
  MAX_CART_ITEM_QUANTITY,
  useCart,
} from "@/components/providers/cart-provider";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";

function CartQuantityInput({
  productName,
  quantity,
  maximumQuantity,
  onCommit,
}: {
  productName: string;
  quantity: number;
  maximumQuantity: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));
  const isDisabled = maximumQuantity < 1;

  function commitQuantity() {
    const parsedQuantity = Number.parseInt(draft, 10);
    const nextQuantity = Number.isFinite(parsedQuantity)
      ? Math.min(maximumQuantity, Math.max(1, parsedQuantity))
      : quantity;

    setDraft(String(nextQuantity));
    if (nextQuantity !== quantity) {
      onCommit(nextQuantity);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={`Количество товара ${productName}`}
      value={draft}
      disabled={isDisabled}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (nextValue === "" || /^\d+$/.test(nextValue)) {
          setDraft(nextValue);
        }
      }}
      onBlur={commitQuantity}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(String(quantity));
          event.currentTarget.blur();
        }
      }}
      className="h-9 w-16 border border-[color:var(--line)] bg-[var(--surface-strong)] px-2 text-center text-sm font-semibold text-[var(--foreground)] focus:border-[color:var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-[4.5rem]"
    />
  );
}

export function CartView({ products }: { products: FeaturedProduct[] }) {
  const { items, updateQuantity, removeItem } = useCart();

  const rows = items
    .map((item) => {
      const product = products.find((p) => p.slug === item.productSlug);
      if (!product) return null;
      return { ...item, product };
    })
    .filter(
      (
        item,
      ): item is {
        productSlug: string;
        quantity: number;
        product: FeaturedProduct;
      } => item !== null,
    );
  const totals = rows.reduce(
    (sum, row) => {
      const finalPrice =
        typeof row.product.price === "number" ? row.product.price : 0;
      const basePrice =
        row.product.isPromotional &&
        typeof row.product.oldPrice === "number" &&
        row.product.oldPrice > finalPrice
          ? row.product.oldPrice
          : finalPrice;

      return {
        beforeDiscountSubtotal:
          sum.beforeDiscountSubtotal + basePrice * row.quantity,
        subtotal: sum.subtotal + finalPrice * row.quantity,
      };
    },
    {
      beforeDiscountSubtotal: 0,
      subtotal: 0,
    },
  );
  const beforeDiscountSubtotal = totals.beforeDiscountSubtotal;
  const subtotal = totals.subtotal;
  const promotionDiscountTotal = Math.max(0, beforeDiscountSubtotal - subtotal);
  const hasStockIssues = rows.some(
    (row) =>
      row.product.stockQuantity !== null &&
      row.quantity > row.product.stockQuantity,
  );

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <SectionHeading
        title="Корзина"
        description="Проверьте товары, количество и переходите к оформлению заказа."
      />

      {rows.length === 0 ? (
        <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-8 text-center">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            Корзина пока пустая
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Добавьте товары из каталога, чтобы оформить заказ.
          </p>
          <Link
            href="/catalog"
            className={getButtonClassName("primary", "md", "mt-6")}
          >
            Перейти в каталог
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {rows.map((row) => {
              const maximumQuantity = Math.min(
                MAX_CART_ITEM_QUANTITY,
                row.product.stockQuantity ?? MAX_CART_ITEM_QUANTITY,
              );

              return (
                <article
                  key={row.productSlug}
                  className="surface-glow flex flex-col gap-4 rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 gap-4">
                    <Link
                      href={`/product/${row.product.slug}`}
                      className="relative size-20 shrink-0 overflow-hidden border border-[color:var(--line)] bg-white"
                      aria-label={`Открыть ${row.product.name}`}
                    >
                      <ProductImage
                        src={row.product.image}
                        alt={row.product.name}
                        fill
                        sizes="80px"
                        className="object-contain p-1"
                      />
                    </Link>
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--muted)]">
                        {row.product.brand}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                        <Link
                          href={`/product/${row.product.slug}`}
                          className="hover:text-[var(--accent)]"
                        >
                          {row.product.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {typeof row.product.price === "number"
                          ? formatPrice(row.product.price)
                          : row.product.action}
                      </p>
                      {row.product.isPromotional &&
                      typeof row.product.oldPrice === "number" ? (
                        <p className="mt-1 text-xs text-[var(--accent)]">
                          Акция: было {formatPrice(row.product.oldPrice)}
                        </p>
                      ) : null}
                      {row.product.isBundle ? (
                        <p className="mt-2 inline-flex w-fit items-center rounded-full bg-[#f1eee8] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]">
                          Комплект
                          {row.product.bundleItems.length > 0
                            ? `: ${row.product.bundleItems.length} поз.`
                            : ""}
                        </p>
                      ) : null}
                      {row.product.stockQuantity !== null ? (
                        <p
                          className={`mt-2 text-xs ${
                            row.quantity > row.product.stockQuantity
                              ? "font-semibold text-rose-700"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          Доступно: {row.product.stockQuantity} шт.
                          {row.quantity > row.product.stockQuantity
                            ? " Уменьшите количество в корзине."
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Уменьшить количество ${row.product.name}`}
                      onClick={() =>
                        updateQuantity(
                          row.productSlug,
                          Math.max(1, row.quantity - 1),
                        )
                      }
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </Button>
                    <CartQuantityInput
                      key={`${row.productSlug}:${row.quantity}`}
                      productName={row.product.name}
                      quantity={row.quantity}
                      maximumQuantity={maximumQuantity}
                      onCommit={(quantity) =>
                        updateQuantity(row.productSlug, quantity)
                      }
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Увеличить количество ${row.product.name}`}
                      onClick={() =>
                        updateQuantity(row.productSlug, row.quantity + 1)
                      }
                      disabled={
                        maximumQuantity < 1 || row.quantity >= maximumQuantity
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(row.productSlug)}
                    >
                      Удалить
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="surface-glow h-fit rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Итого
            </h3>
            <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
              {promotionDiscountTotal > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">До акции</span>
                    <span>{formatPrice(beforeDiscountSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[var(--accent)]">
                    <span>Скидка акции</span>
                    <span>-{formatPrice(promotionDiscountTotal)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex items-end justify-between gap-4">
                <span className="text-[var(--muted)]">Сумма заказа</span>
                <span className="text-2xl font-semibold text-[var(--foreground)]">
                  {formatPrice(subtotal)}
                </span>
              </div>
            </div>
            {hasStockIssues ? (
              <Button className="mt-6 w-full" variant="accent" disabled>
                Исправьте количество
              </Button>
            ) : (
              <Link
                href="/checkout"
                className={getButtonClassName("accent", "md", "mt-6 w-full")}
              >
                Оформить заказ
              </Link>
            )}
          </aside>
        </div>
      )}
    </Container>
  );
}
