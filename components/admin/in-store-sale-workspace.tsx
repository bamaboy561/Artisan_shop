"use client";

import { useActionState, useDeferredValue, useState } from "react";
import {
  BadgePercent,
  Camera,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

import {
  createInStoreSaleAction,
  type InStoreSaleFormState,
} from "@/app/admin/actions";
import { QrClientScanner } from "@/components/admin/qr-client-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/commerce";
import { cn } from "@/lib/utils";

type SaleClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  loyaltyTierLabel: string;
  loyaltyPointsBalance: number;
  discountPercent: number;
};

type SaleProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  brandName: string | null;
  categoryName: string;
};

type CartLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type InStoreSaleWorkspaceProps = {
  clients: SaleClient[];
  products: SaleProduct[];
  initialClientId?: string;
};

const initialState: InStoreSaleFormState = {};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getSearchValue(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
}

function getClientMeta(client: SaleClient) {
  return `${client.loyaltyTierLabel} · скидка ${client.discountPercent}% · ${formatNumber(
    client.loyaltyPointsBalance,
  )} баллов`;
}

function getClientIdCandidatesFromQr(value: string) {
  const trimmedValue = value.trim();
  const candidates = new Set<string>();

  if (!trimmedValue) {
    return [];
  }

  candidates.add(trimmedValue);

  try {
    const url = new URL(trimmedValue, "https://artisan.shop.kg");
    const clientId = url.searchParams.get("client");
    const pathMatch = url.pathname.match(/\/client-qr\/([^/?#]+)/);

    if (clientId) {
      candidates.add(clientId);
    }

    if (pathMatch?.[1]) {
      candidates.add(decodeURIComponent(pathMatch[1]));
    }
  } catch {
    const pathMatch = trimmedValue.match(/\/?client-qr\/([^/?#\s]+)/);

    if (pathMatch?.[1]) {
      candidates.add(decodeURIComponent(pathMatch[1]));
    }
  }

  return Array.from(candidates).map((candidate) => candidate.trim());
}

export function InStoreSaleWorkspace({
  clients,
  products,
  initialClientId,
}: InStoreSaleWorkspaceProps) {
  const [state, formAction, isPending] = useActionState(
    createInStoreSaleAction,
    initialState,
  );
  const [clientQuery, setClientQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId && clients.some((client) => client.id === initialClientId)
      ? initialClientId
      : (clients[0]?.id ?? ""),
  );
  const [lines, setLines] = useState<CartLine[]>([]);
  const deferredClientQuery = useDeferredValue(clientQuery);
  const deferredProductQuery = useDeferredValue(productQuery);
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  const normalizedClientQuery = deferredClientQuery.toLocaleLowerCase("ru-RU");
  const normalizedProductQuery =
    deferredProductQuery.toLocaleLowerCase("ru-RU");
  const filteredClients = clients
    .filter((client) =>
      getSearchValue([
        client.name,
        client.email,
        client.phone,
        client.companyName,
      ]).includes(normalizedClientQuery),
    )
    .slice(0, 12);
  const filteredProducts = products
    .filter((product) =>
      getSearchValue([
        product.name,
        product.sku,
        product.brandName,
        product.categoryName,
      ]).includes(normalizedProductQuery),
    )
    .slice(0, 24);
  const lineProducts = lines
    .map((line) => ({
      line,
      product: products.find((product) => product.id === line.productId),
    }))
    .filter((item) => item.product);
  const subtotal = lineProducts.reduce(
    (sum, item) => sum + item.line.unitPrice * item.line.quantity,
    0,
  );
  const discountTotal = selectedClient
    ? Math.round((subtotal * selectedClient.discountPercent) / 100)
    : 0;
  const total = Math.max(0, subtotal - discountTotal);
  const selectedItemsCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  function addProduct(product: SaleProduct) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);

      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          quantity: 1,
          unitPrice: product.price,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setLines((current) =>
      current
        .map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.max(1, quantity) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function updatePrice(productId: string, unitPrice: number) {
    setLines((current) =>
      current.map((line) =>
        line.productId === productId
          ? { ...line, unitPrice: Math.max(0, Math.round(unitPrice)) }
          : line,
      ),
    );
  }

  function removeProduct(productId: string) {
    setLines((current) =>
      current.filter((line) => line.productId !== productId),
    );
  }

  function handleClientQrScan(value: string) {
    const candidates = getClientIdCandidatesFromQr(value);
    const scannedClient = clients.find((client) =>
      candidates.includes(client.id),
    );

    if (!scannedClient) {
      setScannerMessage(
        "QR считан, но клиент не найден в списке. Проверьте, что клиент зарегистрирован.",
      );
      return false;
    }

    setSelectedClientId(scannedClient.id);
    setClientQuery("");
    setScannerMessage(`Клиент выбран: ${scannedClient.name}`);
    setScannerOpen(false);
    return true;
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_430px] 2xl:items-start">
      <QrClientScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleClientQrScan}
      />

      <div className="grid min-w-0 gap-4">
        <section className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white">
                    <UserRound className="size-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                      Клиент
                    </p>
                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                      Выбор клиента
                    </h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setScannerMessage(null);
                      setScannerOpen(true);
                    }}
                    className="rounded-full"
                  >
                    <Camera className="size-4" />
                    Сканировать QR
                  </Button>
                  <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
                    {clients.length} клиентов
                  </span>
                </div>
              </div>

              {scannerMessage ? (
                <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                  {scannerMessage}
                </div>
              ) : null}

              <label className="mt-4 block">
                <span className="relative block">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Имя, телефон, email"
                    className="pl-9"
                  />
                </span>
              </label>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {filteredClients.map((client) => {
                  const isSelected = client.id === selectedClientId;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={cn(
                        "min-w-[15rem] rounded-[18px] border p-3 text-left transition sm:min-w-[18rem]",
                        isSelected
                          ? "border-[#111111] bg-[#111111] text-white"
                          : "border-[color:var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[color:var(--foreground)]",
                      )}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {client.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block truncate text-xs",
                          isSelected ? "text-white/58" : "text-[var(--muted)]",
                        )}
                      >
                        {client.phone ?? client.email}
                      </span>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold",
                          isSelected
                            ? "bg-white/12 text-white"
                            : "bg-white text-[var(--muted)]",
                        )}
                      >
                        {getClientMeta(client)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-[22px] border border-[color:var(--line)] bg-[var(--surface)] p-4">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                Выбран
              </p>
              {selectedClient ? (
                <div className="mt-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {selectedClient.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selectedClient.phone ?? selectedClient.email}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-xl bg-white px-3 py-2">
                      {selectedClient.loyaltyTierLabel}
                    </span>
                    <span className="rounded-xl bg-white px-3 py-2">
                      {selectedClient.discountPercent}% скидка
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Найдите клиента или откройте страницу по QR.
                </p>
              )}
            </aside>
          </div>
        </section>

        <section className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                Товары
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Добавление в покупку
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(18rem,24rem)_auto] sm:items-center">
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Название, артикул, бренд"
                  className="pl-9"
                />
              </span>
              <span className="rounded-full bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
                {products.length} позиций с ценой
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="group flex min-h-[10rem] flex-col rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:bg-white"
              >
                <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
                  {product.brandName ?? "Без бренда"}
                </span>
                <span className="mt-2 line-clamp-2 min-h-[2.5rem] text-base font-semibold leading-5 text-[var(--foreground)]">
                  {product.name}
                </span>
                <span className="mt-2 line-clamp-1 text-xs text-[var(--muted)]">
                  {product.sku} · {product.categoryName}
                </span>
                <span className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <strong className="text-lg text-[var(--foreground)]">
                    {formatPrice(product.price)}
                  </strong>
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-[var(--accent)] transition group-hover:bg-[#111111] group-hover:text-white">
                    <Plus className="size-4" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <form
        action={formAction}
        className="grid gap-3 rounded-[26px] border border-[color:var(--line)] bg-[#111111] p-4 text-white shadow-[0_22px_58px_rgba(17,17,17,0.16)] 2xl:sticky 2xl:top-4"
      >
        <input type="hidden" name="userId" value={selectedClientId} readOnly />
        <input
          type="hidden"
          name="itemsJson"
          value={JSON.stringify(lines)}
          readOnly
        />

        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111111]">
            <ShoppingBag className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-white/42 uppercase">
              Продажа
            </p>
            <h2 className="truncate text-xl font-semibold">
              {selectedClient?.name ?? "Клиент не выбран"}
            </h2>
          </div>
        </div>

        {state.message ? (
          <div
            className={cn(
              "rounded-2xl border p-3 text-sm leading-5",
              state.success
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-orange-400/20 bg-orange-400/10 text-orange-100",
            )}
          >
            {state.message}
            {state.orderNumber ? (
              <span className="mt-1 block text-xs opacity-75">
                Заказ: {state.orderNumber}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="grid max-h-[32rem] gap-2 overflow-y-auto pr-1">
          {lineProducts.length > 0 ? (
            lineProducts.map(({ line, product }) =>
              product ? (
                <article
                  key={line.productId}
                  className="rounded-[18px] border border-white/10 bg-white/[0.06] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-5">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-white/42">
                        {product.sku}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(line.productId)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/54 transition hover:bg-white hover:text-[#111111]"
                      aria-label="Убрать товар"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <div className="flex h-10 items-center rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(line.productId, line.quantity - 1)
                        }
                        className="flex h-full w-9 items-center justify-center text-white/58 transition hover:text-white"
                        aria-label="Уменьшить количество"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        value={line.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            line.productId,
                            Number(event.target.value),
                          )
                        }
                        className="h-full min-w-0 flex-1 bg-transparent text-center text-sm font-semibold outline-none"
                        aria-label="Количество"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(line.productId, line.quantity + 1)
                        }
                        className="flex h-full w-9 items-center justify-center text-white/58 transition hover:text-white"
                        aria-label="Увеличить количество"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <input
                      value={line.unitPrice}
                      onChange={(event) =>
                        updatePrice(line.productId, Number(event.target.value))
                      }
                      className="h-10 min-w-0 rounded-xl border border-white/10 bg-white/8 px-3 text-sm font-semibold text-white outline-none"
                      aria-label="Цена за единицу"
                    />
                  </div>
                </article>
              ) : null,
            )
          ) : (
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-white/54">
              Добавьте товары из списка. Если клиент открыл кабинет по QR, он
              уже будет выбран автоматически.
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-white/10 pt-3 text-sm">
          <label className="grid gap-1.5">
            Кассовый чек
            <input
              name="receiptNumber"
              placeholder="Необязательно"
              className="h-10 rounded-xl border border-white/10 bg-white/8 px-3 text-white outline-none placeholder:text-white/34"
            />
          </label>
          <label className="grid gap-1.5">
            Комментарий
            <input
              name="comment"
              placeholder="Например: забрал со склада"
              className="h-10 rounded-xl border border-white/10 bg-white/8 px-3 text-white outline-none placeholder:text-white/34"
            />
          </label>

          <div className="grid gap-2">
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-white/72">
              <input
                type="checkbox"
                name="applyClientDiscount"
                defaultChecked
                className="mt-1"
              />
              <span className="flex-1">
                Применить скидку клиента{" "}
                {selectedClient ? `${selectedClient.discountPercent}%` : ""}
              </span>
              <BadgePercent className="size-4 shrink-0" />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-white/72">
              <input
                type="checkbox"
                name="approveNow"
                defaultChecked
                className="mt-1"
              />
              <span>
                Оплата подтверждена: начислить баллы сразу. Если снять галочку,
                баллы уйдут в ожидание.
              </span>
            </label>
          </div>
        </div>

        <div className="grid gap-2 rounded-[18px] bg-white/[0.06] p-3 text-sm">
          <div className="flex justify-between gap-3 text-white/58">
            <span>Позиций</span>
            <span>{selectedItemsCount}</span>
          </div>
          <div className="flex justify-between gap-3 text-white/58">
            <span>Сумма</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-3 text-white/58">
            <span>Скидка</span>
            <span>-{formatPrice(discountTotal)}</span>
          </div>
          <div className="flex justify-between gap-3 text-lg font-semibold">
            <span>Итого</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        <div className="grid gap-2">
          <Button
            type="submit"
            variant="accent"
            className="h-12 w-full"
            disabled={!selectedClientId || lines.length === 0 || isPending}
          >
            {isPending ? "Сохраняем..." : "Сохранить продажу"}
          </Button>
          {lines.length > 0 ? (
            <button
              type="button"
              onClick={() => setLines([])}
              className="h-10 rounded-xl border border-white/10 text-sm font-medium text-white/58 transition hover:bg-white/8 hover:text-white"
            >
              Очистить корзину
            </button>
          ) : null}
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50/76">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Продажа попадет в историю клиента, а бонусы будут начислены или
            отправлены на подтверждение.
          </span>
        </div>
      </form>
    </div>
  );
}
