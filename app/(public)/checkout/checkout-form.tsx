"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  LoaderCircle,
  Store,
} from "lucide-react";
import { submitCheckoutAction } from "./actions";
import type { CheckoutFormState } from "./types";
import { useCart } from "@/components/providers/cart-provider";
import { ProductImage } from "@/components/catalog/product-image";
import { formatPrice } from "@/lib/commerce";
import s from "./checkout.module.css";

const initialState: CheckoutFormState = {};
type CheckoutCustomer = {
  email: string;
  name: string;
  phone: string;
  companyName: string;
  loyaltyTierLabel: string;
  pointsBalance: number;
  maxRedeemPercent: number;
  plateMaterialAccrualPercent: number;
  fittingsAccrualPercent: number;
};

export function CheckoutForm({
  databaseReady,
  customer,
}: {
  databaseReady: boolean;
  customer: CheckoutCustomer | null;
}) {
  const router = useRouter();
  const {
    items,
    products,
    isLoading,
    error,
    refreshProducts,
    itemCount,
    clearCart,
    subtotal,
    beforeDiscountSubtotal,
    promotionDiscountTotal,
  } = useCart();
  const [state, formAction, pending] = useActionState(
    submitCheckoutAction,
    initialState,
  );
  const [fields, setFields] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    companyName: customer?.companyName ?? "",
    comment: "",
    promoCode: "",
    redeemPoints: "",
  });
  const handledSuccessRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const maxRedeemablePoints = customer
    ? Math.min(
        customer.pointsBalance,
        Math.floor((subtotal * customer.maxRedeemPercent) / 100),
      )
    : 0;
  const redeemablePoints = Math.min(
    maxRedeemablePoints,
    Math.max(0, Number.parseInt(fields.redeemPoints, 10) || 0),
  );
  const total = Math.max(0, subtotal - redeemablePoints);
  const stockIssues = items.flatMap((item) => {
    const product = products.find((entry) => entry.slug === item.productSlug);
    if (
      !product ||
      product.purchaseMode !== "cart" ||
      !product.inStock ||
      typeof product.price !== "number" ||
      !Number.isFinite(product.price)
    )
      return [`${product?.name ?? item.productSlug}: товар недоступен.`];
    return product.stockQuantity !== null &&
      item.quantity > product.stockQuantity
      ? [
          `${product.name}: доступно ${product.stockQuantity} шт., в корзине ${item.quantity} шт.`,
        ]
      : [];
  });
  const disabled =
    pending || state.success || !databaseReady || stockIssues.length > 0;

  useEffect(() => {
    if (!state.success || !state.redirectTo || handledSuccessRef.current)
      return;
    handledSuccessRef.current = true;
    clearCart();
    router.push(state.redirectTo);
    router.refresh();
  }, [clearCart, router, state.redirectTo, state.success]);

  useEffect(() => {
    if (!state.message) return;
    if (
      ["email", "companyName", "comment", "promoCode"].some(
        (key) => state.fieldErrors?.[key],
      ) &&
      detailsRef.current
    )
      detailsRef.current.open = true;
    errorRef.current?.focus();
  }, [state]);

  function field(name: keyof typeof fields) {
    return {
      name,
      value: fields[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((previous) => ({ ...previous, [name]: event.target.value })),
    };
  }

  return (
    <div className={s.checkout}>
      <Link href="/cart" className={s.back}>
        <ArrowLeft size={17} /> Корзина
      </Link>
      <h1>Оформление заказа</h1>
      {isLoading ? (
        <p role="status" className={s.empty}>
          Обновляем цены и остатки…
        </p>
      ) : error ? (
        <div role="alert" className={s.empty}>
          <p>{error} Корзина сохранена.</p>
          <button className={s.secondary} onClick={refreshProducts}>
            Повторить
          </button>
        </div>
      ) : itemCount === 0 ? (
        <div className={s.empty}>
          <h2>Корзина пока пуста</h2>
          <Link className={s.primary} href="/catalog">
            В каталог <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <div className={s.layout}>
          <form
            id="checkout-form"
            action={formAction}
            onInvalidCapture={(event) => {
              const details = (event.target as HTMLElement).closest("details");
              if (details) details.open = true;
            }}
          >
            <input
              type="hidden"
              name="cartSnapshot"
              value={JSON.stringify(items)}
            />
            <section className={s.section} aria-labelledby="checkout-contact">
              <h2 id="checkout-contact">Контактные данные</h2>
              {!customer && (
                <p className={s.login}>
                  <Link href="/login?next=/checkout">Войти в аккаунт</Link>
                  <span> или оформить без регистрации</span>
                </p>
              )}
              <div className={s.fields}>
                <label>
                  Имя
                  <input
                    {...field("name")}
                    autoComplete="name"
                    required
                    minLength={2}
                    placeholder="Ваше имя"
                    aria-invalid={!!state.fieldErrors?.name}
                    aria-describedby={
                      state.fieldErrors?.name ? "name-error" : undefined
                    }
                  />
                  {state.fieldErrors?.name && (
                    <span id="name-error" className={s.errorText}>
                      {state.fieldErrors.name[0]}
                    </span>
                  )}
                </label>
                <label>
                  Телефон
                  <input
                    {...field("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    minLength={6}
                    placeholder="+996 ___ ___ ___"
                    aria-invalid={!!state.fieldErrors?.phone}
                    aria-describedby={
                      state.fieldErrors?.phone ? "phone-error" : undefined
                    }
                  />
                  {state.fieldErrors?.phone && (
                    <span id="phone-error" className={s.errorText}>
                      {state.fieldErrors.phone[0]}
                    </span>
                  )}
                </label>
              </div>
            </section>
            <section
              className={`${s.section} ${s.pickup}`}
              aria-label="Получение заказа"
            >
              <Store size={23} />
              <div>
                <h2>Самовывоз</h2>
                <Link href="/contacts" target="_blank" rel="noreferrer">
                  Адреса магазинов
                </Link>
              </div>
              <strong>Бесплатно</strong>
            </section>
            {customer && (
              <section className={s.section} aria-labelledby="checkout-bonuses">
                <h2 id="checkout-bonuses">Бонусы</h2>
                <p className={s.muted}>
                  Баланс: {customer.pointsBalance} баллов · Доступно к списанию:{" "}
                  {maxRedeemablePoints}
                </p>
                <label className={s.bonusField}>
                  Списать баллы
                  <input
                    {...field("redeemPoints")}
                    type="number"
                    min={0}
                    max={maxRedeemablePoints}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>
              </section>
            )}
            <details ref={detailsRef} className={s.details}>
              <summary>
                Дополнительно <ChevronDown size={18} />
              </summary>
              <div className={s.fields}>
                <label>
                  Email
                  <input
                    {...field("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="mail@example.com"
                  />
                  {state.fieldErrors?.email && (
                    <span className={s.errorText}>
                      {state.fieldErrors.email[0]}
                    </span>
                  )}
                </label>
                <label>
                  Компания / объект
                  <input
                    {...field("companyName")}
                    autoComplete="organization"
                  />
                </label>
                <label>
                  Промокод
                  <input
                    {...field("promoCode")}
                    maxLength={64}
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <span className={s.muted}>
                    Проверяется при подтверждении заказа.
                  </span>
                </label>
                <label className={s.full}>
                  Комментарий
                  <textarea {...field("comment")} rows={3} />
                </label>
              </div>
            </details>
            {state.message && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className={s.alert}
              >
                {state.message}
              </div>
            )}
            {!databaseReady && (
              <p role="alert" className={s.alert}>
                Оформление временно недоступно. Корзина сохранена.
              </p>
            )}
            {stockIssues.length > 0 && (
              <div role="alert" className={s.alert}>
                {stockIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
                <Link href="/cart">Исправить корзину</Link>
              </div>
            )}
          </form>
          <aside className={s.summary} aria-label="Сводка заказа">
            <div className={s.summaryHeading}>
              <h2>Ваш заказ</h2>
              <Link href="/cart">Изменить</Link>
            </div>
            <ul className={s.products}>
              {items.map((item) => {
                const product = products.find(
                  (entry) => entry.slug === item.productSlug,
                );
                return (
                  <li key={item.productSlug}>
                    <div className={s.thumbnail}>
                      <ProductImage
                        src={product?.image}
                        alt={product?.name ?? item.productSlug}
                        fallbackLabel=""
                        width={56}
                        height={56}
                      />
                    </div>
                    <div>
                      <p>{product?.name ?? item.productSlug}</p>
                      <span>
                        {item.quantity} шт. × {formatPrice(product?.price ?? 0)}
                      </span>
                    </div>
                    <strong>
                      {formatPrice((product?.price ?? 0) * item.quantity)}
                    </strong>
                  </li>
                );
              })}
            </ul>
            <dl className={s.totals}>
              <div>
                <dt>Товары · {itemCount} шт.</dt>
                <dd>{formatPrice(beforeDiscountSubtotal)}</dd>
              </div>
              {promotionDiscountTotal > 0 && (
                <div className={s.saving}>
                  <dt>Скидка акции</dt>
                  <dd>−{formatPrice(promotionDiscountTotal)}</dd>
                </div>
              )}
              <div>
                <dt>Самовывоз</dt>
                <dd>Бесплатно</dd>
              </div>
              {redeemablePoints > 0 && (
                <div>
                  <dt>Списание баллов</dt>
                  <dd>−{formatPrice(redeemablePoints)}</dd>
                </div>
              )}
            </dl>
            <div className={s.submitBar}>
              <div>
                <span>Итого</span>
                <strong aria-live="polite">{formatPrice(total)}</strong>
              </div>
              <button
                type="submit"
                form="checkout-form"
                className={s.primary}
                disabled={disabled}
                aria-busy={pending}
              >
                {pending ? (
                  <LoaderCircle size={18} className={s.spinner} />
                ) : (
                  <ArrowRight size={18} />
                )}
                <span>{pending ? "Оформляем…" : "Подтвердить заказ"}</span>
              </button>
            </div>
            {customer && (
              <p className={s.loyalty}>
                Начисление: плиты {customer.plateMaterialAccrualPercent}%,
                фурнитура {customer.fittingsAccrualPercent}%. Баллы после
                подтверждения заказа.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
