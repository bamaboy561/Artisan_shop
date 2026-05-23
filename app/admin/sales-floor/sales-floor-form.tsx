"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, UserRound } from "lucide-react";

import { createSalesFloorOrderAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ProductImage } from "@/components/catalog/product-image";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  loyaltyTier: string;
  loyaltyPointsBalance: number;
  personalDiscountPercent: number;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  stockQuantity: number | null;
  brand: { name: string } | null;
  category: { name: string };
  images: Array<{ url: string }>;
};

type SelectedItem = {
  productId: string;
  quantity: number;
};

type SalesFloorFormProps = {
  customers: CustomerOption[];
  products: ProductOption[];
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} сом`;
}

function getCustomerName(customer: CustomerOption) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.companyName ||
    customer.email
  );
}

function getCustomerSearch(customer: CustomerOption) {
  return [
    customer.email,
    customer.phone,
    customer.firstName,
    customer.lastName,
    customer.companyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU");
}

function getProductSearch(product: ProductOption) {
  return [
    product.name,
    product.sku,
    product.brand?.name,
    product.category.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU");
}

export function SalesFloorForm({ customers, products }: SalesFloorFormProps) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.id ?? "",
  );
  const [items, setItems] = useState<SelectedItem[]>([]);
  const selectedProductIds = new Set(items.map((item) => item.productId));
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const customerResults = customers
    .filter((customer) =>
      getCustomerSearch(customer).includes(
        customerQuery.trim().toLocaleLowerCase("ru-RU"),
      ),
    )
    .slice(0, 8);
  const productResults = products
    .filter((product) => !selectedProductIds.has(product.id))
    .filter((product) =>
      getProductSearch(product).includes(
        productQuery.trim().toLocaleLowerCase("ru-RU"),
      ),
    )
    .slice(0, 12);
  const subtotal = items.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  function addProduct(productId: string) {
    if (selectedProductIds.has(productId)) {
      return;
    }

    setItems((current) => [...current, { productId, quantity: 1 }]);
    setProductQuery("");
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(999, nextQuantity || 1)),
            }
          : item,
      ),
    );
  }

  function removeProduct(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  return (
    <form
      action={createSalesFloorOrderAction}
      className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1fr)_minmax(320px,0.85fr)]"
    >
      <input type="hidden" name="customerId" value={selectedCustomerId} />

      <section className="rounded-[28px] border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(30,28,25,0.05)]">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#111] text-white">
            <UserRound className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Клиент
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              Выберите покупателя
            </h2>
          </div>
        </div>

        <label className="mt-5 grid gap-2 text-sm font-medium">
          Поиск по имени, телефону или email
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Например: Уларa, 0999..."
              className="h-11 pl-10"
            />
          </div>
        </label>

        <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
          {customerResults.map((customer) => {
            const active = customer.id === selectedCustomerId;

            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedCustomerId(customer.id)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-[#111] bg-[#111] text-white"
                    : "border-[color:var(--line)] bg-[#faf8f4] hover:border-[#c65b3a]",
                )}
              >
                <p className="font-semibold">{getCustomerName(customer)}</p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    active ? "text-white/66" : "text-[var(--muted)]",
                  )}
                >
                  {customer.phone ?? customer.email}
                </p>
                <p
                  className={cn(
                    "mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                    active ? "bg-white/12" : "bg-white",
                  )}
                >
                  {customer.loyaltyTier} · {customer.personalDiscountPercent}% ·{" "}
                  {customer.loyaltyPointsBalance} баллов
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(30,28,25,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Товары
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              Добавьте позиции
            </h2>
          </div>
          <span className="rounded-full bg-[#f4e7df] px-3 py-1.5 text-sm text-[#8b442c]">
            {items.length} поз.
          </span>
        </div>

        <label className="mt-5 grid gap-2 text-sm font-medium">
          Поиск по названию, артикулу или бренду
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Петля, направляющая, столешница..."
              className="h-11 pl-10"
            />
          </div>
        </label>

        <div className="mt-4 grid max-h-[610px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {productResults.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product.id)}
              className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-2.5 text-left transition hover:border-[#c65b3a] hover:bg-white"
            >
              <div className="relative aspect-[1.25/1] overflow-hidden rounded-xl bg-[#eee8de]">
                <ProductImage
                  src={product.images[0]?.url}
                  alt={product.name}
                  fill
                  sizes="180px"
                  className="object-cover"
                  fallbackLabel={product.brand?.name ?? "Artisan"}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{product.name}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {[product.brand?.name, product.sku].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatPrice(product.price ?? 0)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#171614] bg-[#111] p-4 text-white shadow-[0_22px_70px_rgba(17,17,17,0.18)]">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/42 uppercase">
          Продажа
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
          {selectedCustomer ? getCustomerName(selectedCustomer) : "Клиент не выбран"}
        </h2>

        <div className="mt-5 grid gap-2">
          {items.length > 0 ? (
            items.map((item) => {
              const product = productMap.get(item.productId);

              if (!product) {
                return null;
              }

              return (
                <div
                  key={item.productId}
                  className="rounded-2xl bg-white/[0.075] p-3"
                >
                  <input type="hidden" name="productId" value={item.productId} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-white/46">
                        {[product.brand?.name, product.sku]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(item.productId)}
                      className="text-xs font-semibold text-white/44 transition hover:text-white"
                    >
                      Убрать
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-full bg-white/8 p-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        max="999"
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            item.productId,
                            Number.parseInt(event.target.value, 10),
                          )
                        }
                        className="h-8 w-14 bg-transparent text-center font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="font-semibold">
                      {formatPrice((product.price ?? 0) * item.quantity)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl bg-white/[0.075] p-4 text-sm leading-6 text-white/62">
              Выберите клиента и добавьте товары из списка. После сохранения
              заказ появится в истории клиента и в админке.
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-white/50">Итого</span>
            <strong className="text-3xl tracking-[-0.05em]">
              {formatPrice(subtotal)}
            </strong>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              Кассовый чек
              <Input
                name="receiptNumber"
                placeholder="Если есть"
                className="h-11 border-white/10 bg-white/10 text-white placeholder:text-white/34"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              Комментарий
              <Textarea
                name="comment"
                placeholder="Например: забрал со склада"
                className="min-h-20 border-white/10 bg-white/10 text-white placeholder:text-white/34"
              />
            </label>

            <Checkbox
              name="applyClientDiscount"
              defaultChecked
              label="Применить скидку клиента"
              description="Учитывается уровень и персональная скидка."
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
            />
            <Checkbox
              name="accrueLoyalty"
              defaultChecked
              label="Начислить бонусы"
              description="Менеджер подтверждает покупку, баллы сразу появятся в кабинете клиента."
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
            />
          </div>
        </div>

        <AdminSubmitButton
          idleLabel="Сохранить продажу"
          pendingLabel="Сохраняем..."
          className="mt-5 h-12 w-full rounded-full bg-white text-[#111] hover:bg-[#f4e7df]"
        />
      </section>
    </form>
  );
}
