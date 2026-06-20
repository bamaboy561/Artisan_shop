import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  FolderClock,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import {
  LoyaltyTransactionType,
  OrderStatus,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/commerce";

type LoyaltyTransactionItem = {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  balanceAfter: number;
  title: string;
  description: string | null;
  createdAt: Date;
  order: {
    number: string | null;
  } | null;
};

type OrderPreview = {
  id: string;
  number: string | null;
  status: OrderStatus;
  total: number;
  createdAt: Date;
};

type RequestPreview = {
  id: string;
  number: string | null;
  type: RequestType;
  status: RequestStatus;
  createdAt: Date;
};

type AccountActivityPanelProps = {
  transactions: LoyaltyTransactionItem[];
  recentOrders: OrderPreview[];
  recentRequests: RequestPreview[];
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getTransactionMeta(type: LoyaltyTransactionType, points: number) {
  if (type === LoyaltyTransactionType.REDEMPTION || points < 0) {
    return {
      icon: ArrowDownLeft,
      tone: "warning" as const,
      pointsClass: "text-rose-600",
      label: "Списание",
    };
  }

  if (type === LoyaltyTransactionType.ORDER_ACCRUAL) {
    return {
      icon: ShoppingBag,
      tone: "accent" as const,
      pointsClass: "text-emerald-700",
      label: "За заказ",
    };
  }

  if (type === LoyaltyTransactionType.BONUS_ACCRUAL) {
    return {
      icon: Sparkles,
      tone: "success" as const,
      pointsClass: "text-emerald-700",
      label: "Бонус",
    };
  }

  return {
    icon: ClipboardList,
    tone: "neutral" as const,
    pointsClass: points >= 0 ? "text-emerald-700" : "text-rose-600",
    label: "Корректировка",
  };
}

function getOrderTone(status: OrderStatus) {
  if (status === OrderStatus.COMPLETED) {
    return "success";
  }

  if (status === OrderStatus.CANCELED) {
    return "warning";
  }

  if (
    status === OrderStatus.CONFIRMED ||
    status === OrderStatus.IN_PRODUCTION ||
    status === OrderStatus.SHIPPED
  ) {
    return "accent";
  }

  return "neutral";
}

function getRequestTone(status: RequestStatus) {
  if (status === RequestStatus.COMPLETED) {
    return "success";
  }

  if (status === RequestStatus.CANCELED) {
    return "warning";
  }

  if (
    status === RequestStatus.IN_REVIEW ||
    status === RequestStatus.QUOTE_SENT ||
    status === RequestStatus.IN_PROGRESS
  ) {
    return "accent";
  }

  return "neutral";
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--line)] px-3 text-[11px] font-semibold tracking-[0.12em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
    >
      {children}
      <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
    </Link>
  );
}

export function AccountActivityPanel({
  transactions,
  recentOrders,
  recentRequests,
}: AccountActivityPanelProps) {
  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
      <article className="surface-glow rounded-[26px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Бонусы
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-2xl">
              Движение баллов
            </h3>
          </div>

          <PanelLink href="/checkout">Списать</PanelLink>
        </div>

        <div className="mt-4 space-y-2">
          {transactions.length > 0 ? (
            transactions.map((transaction) => {
              const meta = getTransactionMeta(
                transaction.type,
                transaction.points,
              );
              const Icon = meta.icon;

              return (
                <article
                  key={transaction.id}
                  className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]">
                        <Icon className="size-4" strokeWidth={1.9} />
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[var(--foreground)]">
                            {transaction.title}
                          </p>
                          <StatusBadge tone={meta.tone}>
                            {meta.label}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                          {formatDate(transaction.createdAt)}
                          {transaction.order?.number
                            ? ` · заказ ${transaction.order.number}`
                            : ""}
                          {transaction.description
                            ? ` · ${transaction.description}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`text-lg font-semibold ${meta.pointsClass}`}
                      >
                        {transaction.points >= 0 ? "+" : ""}
                        {formatNumber(transaction.points)}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {formatNumber(transaction.balanceAfter)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 text-sm leading-6 text-[var(--muted)]">
              После первого заказа здесь появятся начисления и списания баллов.
            </div>
          )}
        </div>
      </article>

      <div className="grid gap-3">
        <article className="surface-glow rounded-[26px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                Заказы
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Последние
              </h3>
            </div>
            <PanelLink href="/account/orders">Все</PanelLink>
          </div>

          <div className="mt-4 space-y-2">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {order.number ?? order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <StatusBadge tone={getOrderTone(order.status)}>
                      {order.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                    {formatPrice(order.total)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 text-sm leading-6 text-[var(--muted)]">
                Заказы появятся после оформления корзины.
              </div>
            )}
          </div>
        </article>

        <article className="surface-glow rounded-[26px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                Заявки
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Расчёты
              </h3>
            </div>
            <PanelLink href="/account/requests">Все</PanelLink>
          </div>

          <div className="mt-4 space-y-2">
            {recentRequests.length > 0 ? (
              recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {request.number ?? request.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {request.type} · {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <StatusBadge tone={getRequestTone(request.status)}>
                      {request.status}
                    </StatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 text-sm leading-6 text-[var(--muted)]">
                Запросы цены и распила будут видны здесь.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[26px] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,242,236,0.86))] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--accent)]">
              <FolderClock className="size-4" strokeWidth={1.9} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                Как ускорить работу
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Оформляйте заявки через кабинет: менеджер увидит историю, файлы,
                статусы и быстрее подготовит расчёт.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
