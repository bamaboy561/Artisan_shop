"use client";

import Link from "next/link";
import { Check, LoaderCircle, ShoppingCart } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { ProductImage } from "@/components/catalog/product-image";
import { useCart } from "@/components/providers/cart-provider";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";
import { Quantity, StorefrontDialog } from "./controls";
import { getQuickPurchaseLimit } from "./quick-purchase-state";
import s from "./storefront.module.css";

type QuickProduct = Pick<
  FeaturedProduct,
  | "slug"
  | "name"
  | "sku"
  | "image"
  | "price"
  | "oldPrice"
  | "stockQuantity"
  | "inStock"
>;

export function QuickAdd({ product }: { product: QuickProduct }) {
  const { items, products, addItem, canAddItem } = useCart();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [added, setAdded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fresh = products.find((item) => item.slug === product.slug);
  const current = fresh ?? product;
  const inCart =
    items.find((item) => item.productSlug === product.slug)?.quantity ?? 0;
  const max = getQuickPurchaseLimit(
    current.stockQuantity,
    current.inStock,
    inCart,
  );
  const amount = Math.max(1, Math.min(quantity, max));
  const price = current.price;
  const available =
    max > 0 &&
    typeof price === "number" &&
    (!fresh || fresh.purchaseMode === "cart") &&
    canAddItem(product.slug);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !available) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    setAdded(0);
    try {
      const accepted = await addItem(product.slug, amount);
      if (accepted) setAdded(amount);
      else
        setError(
          "Остаток изменился или товар недоступен. Проверьте количество.",
        );
    } catch {
      setError("Не удалось добавить товар. Повторите попытку.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={s.quickAddTrigger}
        aria-label={`Выбрать количество: ${product.name}`}
        title="Выбрать количество"
        aria-haspopup="dialog"
        disabled={!available || pending}
        onClick={() => {
          setQuantity(1);
          setAdded(0);
          setError(null);
          setOpen(true);
        }}
      >
        <ShoppingCart size={18} />
      </button>
      <StorefrontDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Добавить в корзину"
      >
        <form onSubmit={submit} className={s.quickPurchase}>
          <div className={s.quickProduct}>
            <ProductImage
              src={product.image}
              alt={product.name}
              fallbackLabel={product.name}
              width={80}
              height={80}
            />
            <div>
              <Link
                href={`/product/${product.slug}`}
                onClick={() => setOpen(false)}
              >
                {product.name}
              </Link>
              <p>Артикул: {product.sku}</p>
              <strong>
                {typeof price === "number" ? formatPrice(price) : "По запросу"}
              </strong>
              {typeof current.oldPrice === "number" &&
                typeof price === "number" &&
                current.oldPrice > price && (
                  <del>{formatPrice(current.oldPrice)}</del>
                )}
            </div>
          </div>
          <div className={s.quickStock}>
            <p>
              {current.stockQuantity !== null
                ? `В наличии: ${current.stockQuantity} шт.`
                : current.inStock
                  ? "В наличии"
                  : "Нет в наличии"}
            </p>
            {inCart > 0 && <p>В корзине: {inCart} шт.</p>}
          </div>
          <fieldset
            disabled={pending || !available}
            className={s.quickQuantity}
          >
            <legend>Количество, шт.</legend>
            {added > 0 ? (
              <p>{added} шт.</p>
            ) : max > 0 ? (
              <Quantity
                value={amount}
                max={max}
                onChange={(value) => {
                  setQuantity(value);
                  setAdded(0);
                }}
              />
            ) : (
              <p>
                {current.inStock && inCart > 0
                  ? "Весь доступный остаток уже в корзине"
                  : "Нет доступного остатка"}
              </p>
            )}
          </fieldset>
          <div className={s.quickTotal}>
            <p>Сумма</p>
            <strong>
              {typeof price === "number" && (added > 0 || max > 0)
                ? formatPrice(price * (added || amount))
                : "—"}
            </strong>
          </div>
          <div className={s.quickFeedback}>
            {error ? (
              <p role="alert" className={s.quickError}>
                {error}
              </p>
            ) : (
              <p role="status" aria-live="polite">
                {added > 0 && (
                  <>
                    <Check size={17} /> Добавлено: {added} шт.
                  </>
                )}
              </p>
            )}
          </div>
          {added > 0 ? (
            <div className={s.quickSuccessActions}>
              <button
                type="button"
                className={s.primaryButton}
                onClick={() => setOpen(false)}
              >
                Продолжить покупки
              </button>
              <Link
                href="/cart"
                className={s.textLink}
                onClick={() => setOpen(false)}
              >
                Перейти в корзину
              </Link>
            </div>
          ) : (
            <button
              type="submit"
              className={s.primaryButton}
              disabled={!available || pending}
              aria-busy={pending}
            >
              {pending ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <ShoppingCart size={18} />
              )}
              {pending ? "Добавляем…" : "Добавить в корзину"}
            </button>
          )}
        </form>
      </StorefrontDialog>
    </>
  );
}
