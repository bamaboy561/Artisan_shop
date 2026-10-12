"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { submitCheckoutAction } from "@/app/(public)/checkout/actions";
import type { CheckoutFormState } from "@/app/(public)/checkout/types";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";

const initialState: CheckoutFormState = {};

type DeliveryMethodOption = {
  id: string;
  name: string;
  price: number;
};

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

type CheckoutFormProps = {
  databaseReady: boolean;
  customer: CheckoutCustomer | null;
  deliveryMethods: DeliveryMethodOption[];
  products: FeaturedProduct[];
};

function getCartPrice(product: FeaturedProduct | undefined, quantity: number) {
  const finalPrice = typeof product?.price === "number" ? product.price : 0;
  const basePrice =
    product?.isPromotional &&
    typeof product.oldPrice === "number" &&
    product.oldPrice > finalPrice
      ? product.oldPrice
      : finalPrice;

  return {
    baseTotal: basePrice * quantity,
    finalTotal: finalPrice * quantity,
  };
}

export function CheckoutForm({
  databaseReady,
  customer,
  deliveryMethods,
  products,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, itemCount, clearCart } = useCart();
  const [state, formAction, pending] = useActionState(
    submitCheckoutAction,
    initialState,
  );
  const [deliveryMethodId, setDeliveryMethodId] = useState(
    () => deliveryMethods[0]?.id ?? "",
  );
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const handledSuccessRef = useRef(false);
  const totals = items.reduce(
    (sum, item) => {
      const product = products.find(
        (catalogProduct) => catalogProduct.slug === item.productSlug,
      );
      const price = getCartPrice(product, item.quantity);

      return {
        beforeDiscountSubtotal: sum.beforeDiscountSubtotal + price.baseTotal,
        subtotal: sum.subtotal + price.finalTotal,
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
  const stockIssues = items.flatMap((item) => {
    const product = products.find(
      (catalogProduct) => catalogProduct.slug === item.productSlug,
    );

    if (
      !product ||
      product.stockQuantity === null ||
      item.quantity <= product.stockQuantity
    ) {
      return [];
    }

    return [
      `${product.name}: в корзине ${item.quantity} шт., доступно ${product.stockQuantity} шт.`,
    ];
  });
  const hasStockIssues = stockIssues.length > 0;

  useEffect(() => {
    if (!state.success || !state.redirectTo || handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;
    clearCart();
    router.push(state.redirectTo);
    router.refresh();
  }, [clearCart, router, state.redirectTo, state.success]);

  const selectedDeliveryPrice =
    deliveryMethods.find((item) => item.id === deliveryMethodId)?.price ?? 0;
  const requestedRedeemPoints = Math.max(
    0,
    Number.parseInt(redeemPointsInput || "0", 10) || 0,
  );
  const maxRedeemablePoints = customer
    ? Math.min(
        customer.pointsBalance,
        Math.floor((subtotal * customer.maxRedeemPercent) / 100),
      )
    : 0;
  const redeemablePoints = customer
    ? Math.min(requestedRedeemPoints, maxRedeemablePoints)
    : 0;
  const total = Math.max(
    0,
    subtotal - redeemablePoints + selectedDeliveryPrice,
  );
  const estimatedPoints = customer
    ? Math.floor(
        (Math.max(0, subtotal - redeemablePoints) *
          customer.plateMaterialAccrualPercent) /
          100,
      )
    : 0;
  const cartSnapshot = JSON.stringify(items);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <SectionHeading
        title="Оформление заказа"
        description="Проверьте состав корзины, заполните контакты и отправьте заказ менеджеру."
      />

      {itemCount === 0 ? (
        <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-8 text-center">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            В корзине пока нет товаров
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Добавьте материалы или фурнитуру из каталога, чтобы перейти к
            оформлению.
          </p>
          <Link href="/catalog" className="mt-6 inline-flex">
            <Button>Перейти в каталог</Button>
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
            {!databaseReady ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                Для реального оформления заказа подключите PostgreSQL и
                примените Prisma-схему. После этого форма начнет создавать
                заказы в базе.
              </div>
            ) : null}

            <form action={formAction} className="mt-6 grid gap-4">
              <input type="hidden" name="cartSnapshot" value={cartSnapshot} />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Имя
                  <Input
                    name="name"
                    autoComplete="name"
                    placeholder="Айбек Асанов"
                    defaultValue={customer?.name}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Телефон
                  <Input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+996 555 123 456"
                    defaultValue={customer?.phone}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Email
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@mail.kg"
                    defaultValue={customer?.email}
                  />
                </label>
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Компания / объект
                  <Input
                    name="companyName"
                    placeholder="Студия, объект или компания"
                    defaultValue={customer?.companyName}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Город
                  <Input
                    name="city"
                    placeholder="Бишкек"
                    defaultValue="Бишкек"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Способ доставки
                  <Select
                    name="deliveryMethodId"
                    value={deliveryMethodId}
                    onChange={(event) =>
                      setDeliveryMethodId(event.target.value)
                    }
                  >
                    <option value="">Выберите способ доставки</option>
                    {deliveryMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[var(--foreground)]">
                  Промокод
                  <Input
                    name="promoCode"
                    placeholder="ARTISAN1000"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <span className="text-xs leading-6 text-[var(--muted)]">
                    Скидка применится после проверки кода.
                  </span>
                </label>

                {customer ? (
                  <label className="grid gap-2 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--foreground)]">
                    <span className="font-semibold">Списать бонусы</span>
                    <Input
                      name="redeemPoints"
                      type="number"
                      min="0"
                      max={maxRedeemablePoints}
                      value={redeemPointsInput}
                      onChange={(event) =>
                        setRedeemPointsInput(event.target.value)
                      }
                      placeholder="0"
                      inputMode="numeric"
                    />
                    <span className="text-xs leading-6 text-[var(--muted)]">
                      Доступно {customer.pointsBalance} баллов. За эту покупку
                      можно списать до {formatPrice(maxRedeemablePoints)} (
                      {customer.maxRedeemPercent}% суммы).
                    </span>
                  </label>
                ) : (
                  <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
                    <p>
                      Войдите или создайте кабинет, чтобы использовать личные
                      статусы и накопленные баллы.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link href="/login?next=/checkout">
                        <Button variant="secondary" size="sm">
                          Войти
                        </Button>
                      </Link>
                      <Link href="/register?next=/checkout">
                        <Button variant="ghost" size="sm">
                          Регистрация
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Комментарий к заказу
                <Textarea
                  name="comment"
                  className="min-h-32"
                  placeholder="Уточнения по отгрузке, времени связи или проекту."
                />
              </label>

              {state.message ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {state.message}
                </p>
              ) : null}

              {hasStockIssues ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <p className="font-semibold">
                    Количество превышает доступный остаток.
                  </p>
                  {stockIssues.map((issue) => (
                    <p key={issue} className="mt-1">
                      {issue}
                    </p>
                  ))}
                  <Link
                    href="/cart"
                    className="mt-2 inline-flex font-semibold underline underline-offset-4"
                  >
                    Исправить корзину
                  </Link>
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full sm:w-auto"
                variant="accent"
                disabled={pending || !databaseReady || hasStockIssues}
              >
                {pending ? "Оформляем заказ..." : "Подтвердить заказ"}
              </Button>
            </form>
          </section>

          <aside className="surface-glow h-fit rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Сводка заказа
            </h3>
            <div className="mt-5 space-y-3 text-sm text-[var(--foreground)]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted)]">Товаров</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted)]">
                  {promotionDiscountTotal > 0 ? "До акции" : "Сумма"}
                </span>
                <span>
                  {formatPrice(
                    promotionDiscountTotal > 0
                      ? beforeDiscountSubtotal
                      : subtotal,
                  )}
                </span>
              </div>
              {promotionDiscountTotal > 0 ? (
                <div className="flex items-center justify-between gap-4 text-[var(--accent)]">
                  <span>Скидка акции</span>
                  <span>-{formatPrice(promotionDiscountTotal)}</span>
                </div>
              ) : null}
              {promotionDiscountTotal > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">После акции</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted)]">Доставка</span>
                <span>
                  {deliveryMethodId ? formatPrice(selectedDeliveryPrice) : "—"}
                </span>
              </div>
              {customer ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">Списание бонусов</span>
                  <span>
                    {redeemablePoints > 0
                      ? `-${formatPrice(redeemablePoints)}`
                      : "—"}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4">
              <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                Итого
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                {formatPrice(total)}
              </p>
            </div>

            {customer ? (
              <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--foreground)]">
                <p className="font-semibold">
                  Ваш уровень: {customer.loyaltyTierLabel}
                </p>
                <p className="mt-2 text-[var(--muted)]">
                  Баланс: {customer.pointsBalance} баллов. Начисление: плитные
                  материалы {customer.plateMaterialAccrualPercent}%, фурнитура{" "}
                  {customer.fittingsAccrualPercent}%.
                  {maxRedeemablePoints > 0
                    ? ` Сейчас можно списать до ${formatPrice(maxRedeemablePoints)}.`
                    : ""}
                  {estimatedPoints > 0
                    ? ` После оформления начислим около ${estimatedPoints} баллов.`
                    : " Баллы начнут копиться после первого заказа."}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
                После входа в личный кабинет здесь появятся баллы, статусы и
                история заказов.
              </div>
            )}
          </aside>
        </div>
      )}
    </Container>
  );
}
