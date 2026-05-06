import Link from "next/link";
import {
  ArrowDownLeft,
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
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
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

export function AccountActivityPanel({
  transactions,
  recentOrders,
  recentRequests,
}: AccountActivityPanelProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <article className="reveal-up surface-glow rounded-[30px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.24em] text-[var(--accent)] uppercase">
              Loyalty activity
            </p>
            <h3 className="font-display mt-3 text-3xl leading-tight text-balance text-[var(--foreground)]">
              История начислений и списаний.
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Каждая операция показывает, как меняется ваш баланс и с каким
              заказом она связана.
            </p>
          </div>

          <ButtonLink href="/checkout" variant="secondary" icon>
            Перейти к checkout
          </ButtonLink>
        </div>

        <div className="mt-6 space-y-3">
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
                  className="group rounded-[24px] border border-[color:var(--line)] bg-white/82 px-5 py-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)]">
                        <Icon className="size-5 text-[var(--accent)]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--foreground)]">
                            {transaction.title}
                          </p>
                          <StatusBadge tone={meta.tone}>
                            {meta.label}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {transaction.order?.number
                            ? `Связано с заказом ${transaction.order.number}.`
                            : ""}
                          {transaction.description
                            ? ` ${transaction.description}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-2xl font-semibold ${meta.pointsClass}`}
                      >
                        {transaction.points >= 0 ? "+" : ""}
                        {formatNumber(transaction.points)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Баланс: {formatNumber(transaction.balanceAfter)}
                      </p>
                      <p className="mt-2 text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                        {formatDate(transaction.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-[color:var(--line)] bg-white/82 px-5 py-5 text-sm leading-7 text-[var(--muted)]">
              После первого заказа здесь появится история накоплений, списаний и
              ручных корректировок менеджером.
            </div>
          )}
        </div>
      </article>

      <div className="grid gap-4">
        <article className="reveal-up surface-glow rounded-[30px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 delay-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs tracking-[0.22em] text-[var(--muted)] uppercase">
                Orders
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Последние заказы
              </h3>
            </div>
            <Link href="/account/orders">
              <Button variant="ghost" size="sm">
                Все заказы
              </Button>
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[22px] border border-[color:var(--line)] bg-white/78 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {order.number ?? order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <StatusBadge tone={getOrderTone(order.status)}>
                      {order.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                    {formatPrice(order.total)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/78 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                Как только вы оформите первый заказ, он появится в этой ленте.
              </div>
            )}
          </div>
        </article>

        <article className="reveal-up surface-glow rounded-[30px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 delay-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs tracking-[0.22em] text-[var(--muted)] uppercase">
                Requests
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Запросы и расчёты
              </h3>
            </div>
            <Link href="/account/requests">
              <Button variant="ghost" size="sm">
                Все заявки
              </Button>
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentRequests.length > 0 ? (
              recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-[22px] border border-[color:var(--line)] bg-white/78 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {request.number ?? request.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
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
              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/78 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                Новые расчёты, запросы цены и сервисные заявки будут появляться
                здесь по мере работы с каталогом и услугами.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[30px] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,242,236,0.84))] p-6">
          <div className="flex items-start gap-3">
            <FolderClock className="mt-0.5 size-5 text-[var(--accent)]" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Как быстрее перейти на следующий уровень
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                Оформляйте заказы через сайт, используйте единый кабинет для
                заявок на распил и сохраняйте часто используемые позиции в
                избранное. Так вся история закрепляется за вашим профилем и
                ускоряет рост статуса.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
