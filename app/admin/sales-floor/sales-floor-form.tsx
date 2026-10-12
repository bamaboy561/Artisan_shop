"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import {
  Camera,
  Minus,
  Plus,
  QrCode,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { createSalesFloorOrderAction } from "@/app/admin/actions";
import { rankProductSearch } from "@/features/admin/product-search";
import {
  SalesInvoiceImport,
  type ImportedSaleItem,
} from "@/app/admin/sales-floor/invoice-import";
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
  plateMaterialLoyaltyTier: string | null;
  fittingsLoyaltyTier: string | null;
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
  invoicePrice?: number;
};

type SalesFloorFormProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  photoEnabled?: boolean;
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} сом`;
}

function formatProductPrice(value: number | null) {
  return typeof value === "number" && value > 0
    ? formatPrice(value)
    : "Цена не указана";
}

function getCustomerName(customer: CustomerOption) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.companyName ||
    customer.email
  );
}

function getDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function isSamePhone(left: string | null | undefined, right: string) {
  const leftDigits = getDigits(left);
  const rightDigits = getDigits(right);

  return (
    leftDigits.length >= 3 &&
    rightDigits.length >= 3 &&
    (leftDigits === rightDigits ||
      leftDigits.endsWith(rightDigits) ||
      rightDigits.endsWith(leftDigits))
  );
}

function getCustomerSearch(customer: CustomerOption) {
  const phoneDigits = getDigits(customer.phone);

  return [
    customer.email,
    customer.phone,
    phoneDigits,
    customer.firstName,
    customer.lastName,
    customer.companyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU");
}

function mergeCustomerOptions(
  primary: CustomerOption[],
  current: CustomerOption[],
  selectedCustomerId: string,
) {
  const merged = new Map<string, CustomerOption>();

  for (const customer of primary) {
    merged.set(customer.id, customer);
  }

  const selectedCustomer = current.find(
    (customer) => customer.id === selectedCustomerId,
  );

  if (selectedCustomer && !merged.has(selectedCustomer.id)) {
    merged.set(selectedCustomer.id, selectedCustomer);
  }

  return Array.from(merged.values());
}

async function fetchCustomerOptions(query: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/customers?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Customer search failed");
  }

  const payload = (await response.json()) as { customers?: CustomerOption[] };

  return Array.isArray(payload.customers) ? payload.customers : [];
}

function mergeProductOptions(
  primary: ProductOption[],
  current: ProductOption[],
  selectedProductIds: Set<string>,
) {
  const merged = new Map(primary.map((product) => [product.id, product]));

  for (const product of current) {
    if (selectedProductIds.has(product.id) && !merged.has(product.id)) {
      merged.set(product.id, product);
    }
  }

  return Array.from(merged.values());
}

async function fetchProductOptions(query: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/products?q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new Error("Product search failed");
  }

  const payload = (await response.json()) as { products?: ProductOption[] };
  return Array.isArray(payload.products) ? payload.products : [];
}

export function SalesFloorForm({
  customers,
  products,
  photoEnabled = false,
}: SalesFloorFormProps) {
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(
    null,
  );
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState(products);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(
    null,
  );
  const [qrValue, setQrValue] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.id ?? "",
  );
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [invoiceReference, setInvoiceReference] = useState("");
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId)),
    [items],
  );
  const productMap = useMemo(
    () => new Map(productOptions.map((product) => [product.id, product])),
    [productOptions],
  );
  const selectedCustomer = customerOptions.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const customerResults = customerOptions.slice(0, 12);
  const productResults = rankProductSearch(productOptions, productQuery)
    .filter((product) => !selectedProductIds.has(product.id))
    .slice(0, 12);
  const subtotal = items.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (item.invoicePrice ?? product?.price ?? 0) * item.quantity;
  }, 0);
  // Личная скидка не действует на строки с ценой из счёта: это уже итоговая цена.
  const personalDiscountPercent =
    selectedCustomer?.personalDiscountPercent ?? 0;
  const personalDiscountTotal = Math.round(
    (items.reduce((sum, item) => {
      if (item.invoicePrice !== undefined) return sum;
      const product = productMap.get(item.productId);
      return sum + (product?.price ?? 0) * item.quantity;
    }, 0) *
      personalDiscountPercent) /
      100,
  );
  const subtotalAfterPersonalDiscount = Math.max(
    0,
    subtotal - personalDiscountTotal,
  );
  const requestedRedeemPoints = Math.max(
    0,
    Number.parseInt(redeemPointsInput || "0", 10) || 0,
  );
  const maxRedeemablePoints = selectedCustomer
    ? Math.min(
        selectedCustomer.loyaltyPointsBalance,
        Math.floor(subtotalAfterPersonalDiscount * 0.5),
      )
    : 0;
  const redeemablePoints = selectedCustomer
    ? Math.min(requestedRedeemPoints, maxRedeemablePoints)
    : 0;
  const total = Math.max(0, subtotalAfterPersonalDiscount - redeemablePoints);

  useEffect(() => {
    const query = customerQuery.trim();

    if (!query) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      setCustomerSearchError(null);

      try {
        const nextCustomers = await fetchCustomerOptions(
          query,
          controller.signal,
        );
        setCustomerOptions((current) =>
          mergeCustomerOptions(nextCustomers, current, selectedCustomerId),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCustomerSearchError("Не удалось загрузить клиентов.");
      } finally {
        if (!controller.signal.aborted) {
          setCustomerLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [customerQuery, customers, selectedCustomerId]);

  useEffect(() => {
    const query = productQuery.trim();

    if (!query) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setProductLoading(true);
      setProductSearchError(null);

      try {
        const nextProducts = await fetchProductOptions(
          query,
          controller.signal,
        );
        setProductOptions((current) =>
          mergeProductOptions(nextProducts, current, selectedProductIds),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setProductSearchError("Не удалось загрузить товары.");
      } finally {
        if (!controller.signal.aborted) setProductLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [productQuery, products, selectedProductIds]);

  function updateProductQuery(value: string, preserveProductId?: string) {
    setProductQuery(value);

    if (!value.trim()) {
      const retainedProductIds = new Set(selectedProductIds);

      if (preserveProductId) {
        retainedProductIds.add(preserveProductId);
      }

      setProductOptions((current) =>
        mergeProductOptions(products, current, retainedProductIds),
      );
      setProductLoading(false);
      setProductSearchError(null);
    }
  }

  function updateCustomerQuery(value: string) {
    setCustomerQuery(value);

    if (!value.trim()) {
      setCustomerOptions((current) =>
        mergeCustomerOptions(customers, current, selectedCustomerId),
      );
      setCustomerLoading(false);
      setCustomerSearchError(null);
    }
  }

  async function selectCustomerByQr(rawValue: string) {
    const value = rawValue.trim();
    const customerId =
      value.match(/^artisan-client:([a-z0-9_-]+)$/i)?.[1] ?? value;
    let customer = customerOptions.find(
      (item) =>
        item.id === customerId ||
        item.email.toLocaleLowerCase("ru-RU") ===
          value.toLocaleLowerCase("ru-RU") ||
        isSamePhone(item.phone, value) ||
        getCustomerSearch(item).includes(value.toLocaleLowerCase("ru-RU")),
    );

    setQrValue(value);

    if (!customer) {
      setScannerMessage("Ищем клиента в базе...");

      try {
        const nextCustomers = await fetchCustomerOptions(customerId);
        customer =
          nextCustomers.find(
            (item) =>
              item.id === customerId ||
              item.email.toLocaleLowerCase("ru-RU") ===
                value.toLocaleLowerCase("ru-RU") ||
              isSamePhone(item.phone, value),
          ) ?? nextCustomers[0];

        setCustomerOptions((current) =>
          mergeCustomerOptions(nextCustomers, current, customer?.id ?? ""),
        );
      } catch {
        setScannerMessage("Не удалось проверить QR клиента.");
        return false;
      }
    }

    if (!customer) {
      setScannerMessage("Клиент по QR не найден.");
      return false;
    }

    setSelectedCustomerId(customer.id);
    setCustomerQuery(getCustomerName(customer));
    setScannerMessage("Клиент выбран по QR.");
    return true;
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerActive(false);
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerMessage(
        "Камера QR недоступна в этом браузере. Можно вставить код вручную.",
      );
      return;
    }

    try {
      setScannerActive(true);
      setScannerMessage("Наведите камеру на QR клиента.");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
        (result) => {
          const value = result?.getText();

          if (value) {
            void selectCustomerByQr(value).then((isSelected) => {
              if (isSelected) {
                stopScanner();
              }
            });
          }
        },
      );

      scannerControlsRef.current = controls;
    } catch {
      setScannerMessage("Не получилось открыть камеру для QR.");
      stopScanner();
    }
  }

  useEffect(() => {
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, []);

  function addProduct(productId: string) {
    const product = productMap.get(productId);

    if (
      !product ||
      (product.stockQuantity !== null && product.stockQuantity <= 0)
    ) {
      return;
    }

    setItems((current) =>
      current.some((item) => item.productId === productId)
        ? current
        : [...current, { productId, quantity: 1 }],
    );
    updateProductQuery("", productId);
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    const stockQuantity = productMap.get(productId)?.stockQuantity;
    const maximumQuantity =
      stockQuantity === null || stockQuantity === undefined
        ? 999
        : Math.max(1, Math.min(999, stockQuantity));

    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(maximumQuantity, nextQuantity || 1),
              ),
            }
          : item,
      ),
    );
  }

  function removeProduct(productId: string) {
    setItems((current) =>
      current.filter((item) => item.productId !== productId),
    );
  }

  function importInvoice(
    imported: ImportedSaleItem[],
    reference: string,
    buyer: string,
  ) {
    if (
      items.length &&
      !window.confirm("Заменить текущий список товаров позициями накладной?")
    )
      return false;
    setProductOptions((current) => {
      const merged = new Map(current.map((product) => [product.id, product]));
      for (const item of imported) merged.set(item.product.id, item.product);
      return [...merged.values()];
    });
    setItems(
      imported.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        invoicePrice: item.unitPrice,
      })),
    );
    setInvoiceReference(reference);
    setProductQuery("");
    setSelectedCustomerId("");
    setCustomerQuery(buyer);
    setRedeemPointsInput("");
    return true;
  }

  return (
    <form
      action={createSalesFloorOrderAction}
      onSubmit={(event) => {
        if (invoiceEditing) event.preventDefault();
      }}
      className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1fr)_minmax(320px,0.85fr)]"
    >
      <input type="hidden" name="customerId" value={selectedCustomerId} />
      <input type="hidden" name="invoiceReference" value={invoiceReference} />

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
              onChange={(event) => updateCustomerQuery(event.target.value)}
              placeholder="Например: Уларa, 0999..."
              className="h-11 pl-10"
            />
            {customerLoading ? (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--muted)]">
                Поиск...
              </span>
            ) : null}
          </div>
        </label>

        {customerSearchError ? (
          <p className="mt-2 text-xs leading-5 text-[#b42318]">
            {customerSearchError}
          </p>
        ) : null}

        <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
          {customerResults.map((customer) => {
            const active = customer.id === selectedCustomerId;

            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setCustomerQuery(getCustomerName(customer));
                }}
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
                  Плиты{" "}
                  {customer.plateMaterialLoyaltyTier ?? customer.loyaltyTier} ·{" "}
                  Фурн. {customer.fittingsLoyaltyTier ?? customer.loyaltyTier} ·{" "}
                  {customer.loyaltyPointsBalance} баллов
                </p>
              </button>
            );
          })}
          {customerLoading ? (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3 text-sm text-[var(--muted)]">
              Ищем клиента...
            </div>
          ) : null}
          {!customerLoading && customerResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--line-strong)] bg-[#faf8f4] p-3 text-sm text-[var(--muted)]">
              Клиент не найден.
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                QR клиента
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Сканируйте QR из кабинета или вставьте код вручную.
              </p>
            </div>
            <button
              type="button"
              onClick={scannerActive ? stopScanner : startScanner}
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#111] text-white transition hover:bg-[#c65b3a]"
              aria-label={
                scannerActive ? "Остановить QR-сканер" : "Открыть QR-сканер"
              }
            >
              {scannerActive ? (
                <X className="size-4" />
              ) : (
                <Camera className="size-4" />
              )}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <QrCode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={qrValue}
                onChange={(event) => setQrValue(event.target.value)}
                placeholder="Отсканируйте QR клиента"
                className="h-10 pl-10"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void selectCustomerByQr(qrValue);
              }}
              className="h-10 rounded-xl border border-[color:var(--line-strong)] px-3 text-xs font-semibold transition hover:bg-white"
            >
              Найти
            </button>
          </div>
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn(
              "mt-3 aspect-video w-full rounded-2xl bg-black object-cover",
              !scannerActive && "hidden",
            )}
          />
          {scannerMessage ? (
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {scannerMessage}
            </p>
          ) : null}
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

        <SalesInvoiceImport
          photoEnabled={photoEnabled}
          onImport={importInvoice}
          onEditing={setInvoiceEditing}
        />
        <label className="mt-5 grid gap-2 text-sm font-medium">
          Поиск по названию, артикулу или бренду
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={productQuery}
              onChange={(event) => updateProductQuery(event.target.value)}
              placeholder="Петля, направляющая, столешница..."
              className="h-11 pl-10"
            />
            {productLoading ? (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--muted)]">
                Поиск...
              </span>
            ) : null}
          </div>
          {productSearchError ? (
            <span className="text-xs text-red-600">{productSearchError}</span>
          ) : null}
        </label>

        <div className="mt-4 grid max-h-[610px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {productResults.map((product) => {
            const isOutOfStock =
              product.stockQuantity !== null && product.stockQuantity <= 0;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                disabled={isOutOfStock}
                className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-2.5 text-left transition hover:border-[#c65b3a] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="leading-5 font-semibold [overflow-wrap:anywhere]">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs leading-4 [overflow-wrap:anywhere] text-[var(--muted)]">
                    {[product.brand?.name, product.sku]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatProductPrice(product.price)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {product.stockQuantity === null
                      ? "Остаток не ограничен"
                      : product.stockQuantity > 0
                        ? `Остаток: ${product.stockQuantity} шт.`
                        : "Нет в наличии"}
                  </p>
                </div>
              </button>
            );
          })}
          {productLoading ? (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3 text-sm text-[var(--muted)] sm:col-span-2">
              Ищем товары...
            </div>
          ) : null}
          {!productLoading && productResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--line-strong)] bg-[#faf8f4] p-3 text-sm text-[var(--muted)] sm:col-span-2">
              Товары не найдены. Проверьте название, артикул или бренд.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#171614] bg-[#111] p-4 text-white shadow-[0_22px_70px_rgba(17,17,17,0.18)]">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/42 uppercase">
          Продажа
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
          {selectedCustomer
            ? getCustomerName(selectedCustomer)
            : "Клиент не выбран"}
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
                  <input
                    type="hidden"
                    name="productId"
                    value={item.productId}
                  />
                  <input
                    type="hidden"
                    name="itemUnitPrice"
                    value={item.invoicePrice ?? ""}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="leading-5 font-semibold [overflow-wrap:anywhere]">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs leading-4 [overflow-wrap:anywhere] text-white/46">
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
                        max={product.stockQuantity ?? 999}
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
                      {formatPrice(
                        (item.invoicePrice ?? product.price ?? 0) *
                          item.quantity,
                      )}
                    </p>
                  </div>
                  {item.invoicePrice !== undefined && (
                    <p className="mt-2 text-xs text-white/60">
                      Цена накладной: {formatPrice(item.invoicePrice)}
                    </p>
                  )}
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
          {personalDiscountTotal > 0 ? (
            <div className="mb-2 flex items-center justify-between gap-4 text-sm text-white/62">
              <span>Личная скидка {personalDiscountPercent}%</span>
              <span>−{formatPrice(personalDiscountTotal)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-white/50">Итого</span>
            <strong className="text-3xl tracking-[-0.05em]">
              {formatPrice(total)}
            </strong>
          </div>
          {selectedCustomer ? (
            <div className="mt-3 rounded-2xl bg-white/[0.06] p-3">
              <label className="grid gap-1.5 text-sm">
                Списать бонусы
                <Input
                  name="redeemPoints"
                  type="number"
                  min="0"
                  max={maxRedeemablePoints}
                  value={redeemPointsInput}
                  onChange={(event) => setRedeemPointsInput(event.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="h-11 border-white/10 bg-white/10 text-white placeholder:text-white/34"
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-white/48">
                Баланс: {selectedCustomer.loyaltyPointsBalance} баллов. За эту
                покупку можно списать до {formatPrice(maxRedeemablePoints)}.
                {redeemablePoints > 0
                  ? ` Применено: ${formatPrice(redeemablePoints)}.`
                  : ""}
              </p>
            </div>
          ) : null}

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
              label="Учитывать бонусный профиль клиента"
              description="Начисление считается по статусам плит и фурнитуры."
              className="hidden"
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
          disabled={invoiceEditing || !selectedCustomerId || !items.length}
          idleLabel="Сохранить продажу"
          pendingLabel="Сохраняем..."
          className="mt-5 h-12 w-full rounded-full bg-white text-[#111] hover:bg-[#f4e7df]"
        />
      </section>
    </form>
  );
}
