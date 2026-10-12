"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, RefreshCw, ShoppingCart } from "lucide-react";
import { prepareReorderAction } from "@/app/account/orders/actions";
import { useCart } from "@/components/providers/cart-provider";
import { ProductImage } from "@/components/catalog/product-image";
import { StorefrontDialog } from "@/features/storefront/controls";
import { planReorder, type ReorderData } from "@/features/cart/reorder";
import { formatPrice } from "@/lib/commerce";
import s from "./repeat-order.module.css";

export function RepeatOrderButton({ orderId }: { orderId: string }) {
  const { items, addItems, isLoading } = useCart();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReorderData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const adding = useRef(false);
  const generation = useRef(0);
  const rows = data ? planReorder(data.items, data.products, items) : [];
  const additions = rows.flatMap((row) =>
    row.quantity > 0 && row.product && typeof row.product.price === "number"
      ? [
          {
            productSlug: row.product.slug,
            quantity: row.quantity,
            unitPrice: row.product.price,
          },
        ]
      : [],
  );
  const total = additions.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  async function load() {
    const request = ++generation.current;
    setBusy(true);
    setError(null);
    setData(null);
    setAdded(null);
    setOpen(true);
    try {
      const result = await prepareReorderAction(orderId);
      if (request !== generation.current) return;
      if (result.data) setData(result.data);
      else setError(result.error);
    } catch {
      if (request === generation.current)
        setError("Не удалось загрузить заказ. Повторите попытку.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function add() {
    if (adding.current || !additions.length) return;
    adding.current = true;
    setBusy(true);
    setError(null);
    try {
      if (await addItems(additions))
        setAdded(additions.reduce((sum, item) => sum + item.quantity, 0));
      else {
        setData(null);
        setError(
          "Цена или остаток изменились. Обновите состав перед добавлением. Корзина не изменена.",
        );
      }
    } catch {
      setError(
        "Не удалось добавить товары. Корзина не изменена. Повторите попытку.",
      );
    } finally {
      adding.current = false;
      setBusy(false);
    }
  }
  function close() {
    setOpen(false);
    if (!adding.current) {
      generation.current++;
      setBusy(false);
    }
  }

  return (
    <div className={s.scope}>
      <button
        type="button"
        className={s.trigger}
        onClick={load}
        disabled={busy || isLoading}
      >
        <RefreshCw size={16} /> Повторить заказ
      </button>
      <StorefrontDialog open={open} onClose={close} title="Повторить заказ">
        <div className={s.content}>
          {busy && (
            <p role="status" className={s.status}>
              <LoaderCircle size={18} />{" "}
              {data ? "Добавляем товары…" : "Проверяем цены и остатки…"}
            </p>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          {added !== null ? (
            <div className={s.success}>
              <p role="status">
                <Check size={20} /> В корзину добавлено: {added} шт.
              </p>
              <Link href="/cart" className={s.primary}>
                Перейти в корзину <ShoppingCart size={18} />
              </Link>
            </div>
          ) : (
            <>
              {data && (
                <>
                  <p className={s.muted}>Текущие цены и доступное количество</p>
                  <ul className={s.lines}>
                    {rows.map((row, index) => (
                      <li key={row.productSlug ?? `missing:${index}`}>
                        <div className={s.thumbnail}>
                          <ProductImage
                            src={row.product?.image}
                            alt={row.name}
                            fallbackLabel=""
                            width={48}
                            height={48}
                          />
                        </div>
                        <div>
                          <p>{row.product?.name ?? row.name}</p>
                          {row.product && <span>Арт. {row.product.sku}</span>}
                          {row.quantity > 0 && (
                            <p>
                              {row.quantity} шт. ×{" "}
                              {formatPrice(row.product?.price ?? 0)}
                            </p>
                          )}
                          {row.alreadyInCart > 0 && (
                            <span>Уже в корзине: {row.alreadyInCart} шт.</span>
                          )}
                          {row.note && <p className={s.warning}>{row.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!rows.length && (
                    <p>В заказе нет товаров для повторной покупки.</p>
                  )}
                  <div className={s.total}>
                    <span>К добавлению</span>
                    <strong>{formatPrice(total)}</strong>
                  </div>
                  {!!additions.length && (
                    <button
                      className={s.primary}
                      disabled={busy || isLoading}
                      onClick={add}
                    >
                      <ShoppingCart size={18} /> Добавить доступное в корзину
                    </button>
                  )}
                </>
              )}
              {error && !data && (
                <button className={s.trigger} disabled={busy} onClick={load}>
                  <RefreshCw size={16} /> Обновить
                </button>
              )}
            </>
          )}
        </div>
      </StorefrontDialog>
    </div>
  );
}
