import Link from "next/link";
import { ArrowUpRight, MapPin, Package, Scissors } from "lucide-react";

import {
  CuttingStage,
  OrderStatus,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import {
  orderStatusLabels,
  requestStatusLabels,
  requestTypeLabels,
} from "@/features/admin/operations-filters";
import { getCuttingStageIndex } from "@/features/cutting/progress";
import { formatPrice } from "@/lib/commerce";
import { cn } from "@/lib/utils";

type ActiveOrder = {
  id: string;
  number: string | null;
  status: OrderStatus;
  total: number;
  productionDueAt: Date | null;
  readyAt: Date | null;
};

type ActiveRequest = {
  id: string;
  number: string | null;
  type: RequestType;
  status: RequestStatus;
  quotedTotal: number | null;
  cuttingStage: CuttingStage | null;
  cuttingPickupCell: string | null;
  productionPlan: { dueDate: Date | null } | null;
};

const orderSteps = ["Принят", "Подтверждён", "Собираем", "Готов"];
const cuttingSteps = ["Принят", "Распил", "Кромка", "Присадка", "Готов"];

function getOrderStepIndex(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
    case OrderStatus.RESERVED:
      return 0;
    case OrderStatus.CONFIRMED:
    case OrderStatus.PAID:
      return 1;
    case OrderStatus.IN_PRODUCTION:
      return 2;
    default:
      return 3;
  }
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(value);
}

function StepsBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mt-3" aria-label={`Этап: ${steps[current] ?? "ожидает"}`}>
      <div className="flex gap-1">
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index < current
                ? "bg-[#2e7d4f]"
                : index === current
                  ? "bg-[var(--accent)]"
                  : "bg-[color:var(--line)]",
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-1 text-[11px] text-[var(--muted)]">
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              index === current && "font-semibold text-[var(--foreground)]",
            )}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AccountCurrentWork({
  orders,
  requests,
}: {
  orders: ActiveOrder[];
  requests: ActiveRequest[];
}) {
  const hasWork = orders.length > 0 || requests.length > 0;

  return (
    <section aria-labelledby="account-current-work" className="space-y-2">
      <h2
        id="account-current-work"
        className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]"
      >
        {hasWork ? "Сейчас в работе" : "Активных заказов нет"}
      </h2>

      {!hasWork ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/catalog"
            className="inline-flex h-10 items-center rounded-full border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 text-sm font-semibold"
          >
            Каталог
          </Link>
          <Link
            href="/calculator"
            className="inline-flex h-10 items-center rounded-full border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 text-sm font-semibold"
          >
            Рассчитать распил
          </Link>
        </div>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-2">
        {requests.map((request) => {
          const isCutting = request.type === RequestType.CUTTING_SERVICE;
          const stageIndex = getCuttingStageIndex(request.cuttingStage);
          const isReady = request.cuttingStage === CuttingStage.READY_FOR_PICKUP;
          const dueDate = request.productionPlan?.dueDate;

          return (
            <Link
              key={request.id}
              href="/account/requests"
              className="group rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 transition hover:border-[color:var(--accent)]/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 font-semibold text-[var(--foreground)]">
                  <Scissors className="size-4 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">
                    {requestTypeLabels[request.type]} {request.number ?? ""}
                  </span>
                </p>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    isReady ? "text-[#2e7d4f]" : "text-[var(--accent)]",
                  )}
                >
                  {isCutting && stageIndex >= 0
                    ? cuttingSteps[stageIndex]
                    : requestStatusLabels[request.status]}
                </span>
              </div>
              {isCutting && stageIndex >= 0 ? (
                <StepsBar steps={cuttingSteps} current={stageIndex} />
              ) : null}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
                {isReady && request.cuttingPickupCell ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#2e7d4f]">
                    <MapPin className="size-3.5" /> Ячейка {request.cuttingPickupCell}
                  </span>
                ) : dueDate && !isReady ? (
                  <span>Готовность: {formatDay(dueDate)}</span>
                ) : !isCutting || stageIndex < 0 ? (
                  <span>Менеджер считает заявку и свяжется с вами</span>
                ) : null}
                {request.quotedTotal ? (
                  <span>{formatPrice(request.quotedTotal)}</span>
                ) : null}
              </p>
            </Link>
          );
        })}

        {orders.map((order) => {
          const stepIndex = getOrderStepIndex(order.status);
          const isReady = stepIndex === 3;
          const awaitingPickup = order.status === OrderStatus.READY_FOR_PICKUP;
          const due = order.readyAt ?? order.productionDueAt;

          return (
            <Link
              key={order.id}
              href="/account/orders"
              className="group rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 transition hover:border-[color:var(--accent)]/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 font-semibold text-[var(--foreground)]">
                  <Package className="size-4 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">Заказ {order.number ?? ""}</span>
                </p>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    isReady ? "text-[#2e7d4f]" : "text-[var(--accent)]",
                  )}
                >
                  {orderStatusLabels[order.status]}
                </span>
              </div>
              <StepsBar steps={orderSteps} current={stepIndex} />
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
                <span>{formatPrice(order.total)}</span>
                {awaitingPickup ? (
                  <span>Забрать: Кулатова 3/1, Пн-Пт 09:00-17:00</span>
                ) : due && !isReady ? (
                  <span>Готовность: {formatDay(due)}</span>
                ) : null}
              </p>
            </Link>
          );
        })}
      </div>

      {hasWork ? (
        <div className="flex gap-4 text-sm font-semibold">
          <Link href="/account/orders" className="inline-flex items-center gap-1 hover:text-[var(--accent)]">
            Все заказы <ArrowUpRight className="size-4" />
          </Link>
          <Link href="/account/requests" className="inline-flex items-center gap-1 hover:text-[var(--accent)]">
            Все заявки <ArrowUpRight className="size-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
