import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatus } from "@/generated/prisma";
import {
  addOrderManagerNoteAction,
  updateOrderAction,
  updateOrderFulfillmentAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { OperationTimeline } from "@/components/admin/operation-timeline";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/auth/dal";
import { getOrderInboxItemById } from "@/lib/server/order-inbox";
import { getOperationEvents } from "@/lib/server/operation-events";
import { getAdminManagers } from "@/lib/server/operations-admin";
import {
  getManagerDisplayName,
  orderStatusLabels,
} from "@/features/admin/operations-filters";
import {
  orderQuickTransitions,
  orderWorkflowSteps,
} from "@/features/admin/workflow";
import { cn } from "@/lib/utils";

type AdminOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "Не задано";
}

function formatInputDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
    case OrderStatus.CONFIRMED:
      return "warning" as const;
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.READY_FOR_PICKUP:
    case OrderStatus.SHIPPED:
      return "accent" as const;
    case OrderStatus.COMPLETED:
      return "success" as const;
    case OrderStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

function OrderWorkflowTrail({ status }: { status: OrderStatus }) {
  const currentIndex = orderWorkflowSteps.findIndex(
    (step) => step.status === status,
  );
  const isCanceled = status === OrderStatus.CANCELED;

  return (
    <div className="grid gap-3">
      {orderWorkflowSteps.map((step, index) => {
        const isActive = step.status === status;
        const isDone = currentIndex > index;

        return (
          <div
            key={step.status}
            className={cn(
              "grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3",
              isActive && "border-[color:var(--foreground)] bg-white",
              isDone && "border-emerald-200 bg-emerald-50/70",
              isCanceled && "opacity-55",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-7 items-center justify-center rounded-full border border-[color:var(--line-strong)] text-[11px] font-semibold",
                (isActive || isDone) &&
                  "border-[color:var(--foreground)] bg-[var(--foreground)] text-white",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                {step.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                {step.summary}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
  await requireAdminSession("/login?next=/admin/orders");

  const { id } = await params;
  const [order, managers, events] = await Promise.all([
    getOrderInboxItemById(id),
    getAdminManagers().catch(() => []),
    getOperationEvents("order", id),
  ]);

  if (!order) {
    notFound();
  }

  const managerNotes = order.managerNotes ?? [];

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <SectionHeading
              title={order.number ?? order.id}
              description="Рабочая карточка заказа: состав, сумма, клиент, ответственный менеджер и движение до выдачи."
              titleClassName="text-2xl sm:text-3xl"
              descriptionClassName="max-w-2xl text-sm leading-7"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={getStatusTone(order.status)}>
                {orderStatusLabels[order.status]}
              </StatusBadge>
              <StatusBadge tone={order.managerId ? "neutral" : "warning"}>
                {order.manager
                  ? getManagerDisplayName(order.manager)
                  : "Без менеджера"}
              </StatusBadge>
              <StatusBadge tone="neutral">
                {order._count.items} поз.
              </StatusBadge>
            </div>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
          >
            К очереди заказов
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Клиент и логистика
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Создан {formatDate(order.createdAt)} · обновлен{" "}
                  {formatDate(order.updatedAt)}
                </p>
              </div>
              <p className="text-2xl font-semibold text-[var(--foreground)]">
                {formatCurrency(order.total)}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Клиент
                </p>
                <p className="mt-2 font-medium text-[var(--foreground)]">
                  {order.contactName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {order.contactPhone}
                </p>
                {order.contactEmail ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {order.contactEmail}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Доставка
                </p>
                <p className="mt-2 font-medium text-[var(--foreground)]">
                  {order.deliveryMethod?.name ?? "Самовывоз / уточнить"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {order.companyName ?? order.user?.companyName ?? "Частный клиент"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  План готовности
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  {formatOptionalDate(order.productionDueAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Готов к выдаче
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  {formatOptionalDate(order.readyAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Закрыт
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  {formatOptionalDate(order.completedAt)}
                </p>
              </div>
            </div>

            {order.fulfillmentComment ? (
              <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Комментарий выдачи
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                  {order.fulfillmentComment}
                </p>
              </div>
            ) : null}

            {order.sourceRequestId ? (
              <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Источник
                </p>
                <Link
                  href={`/admin/requests/${order.sourceRequestId}`}
                  className="mt-2 inline-flex font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
                >
                  Открыть исходную заявку
                </Link>
              </div>
            ) : null}
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Производство и выдача
            </h2>
            <form
              action={updateOrderFulfillmentAction}
              className="mt-5 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                План готовности
                <Input
                  name="productionDueAt"
                  type="date"
                  defaultValue={formatInputDate(order.productionDueAt)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Комментарий для выдачи
                <Textarea
                  name="fulfillmentComment"
                  defaultValue={order.fulfillmentComment ?? ""}
                  rows={3}
                  placeholder="Например: проверить комплектность, самовывоз со склада, связаться перед выдачей."
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)] sm:col-span-2">
                Статус после сохранения
                <Select name="status" defaultValue="">
                  <option value="">Не менять статус</option>
                  <option value={OrderStatus.IN_PRODUCTION}>В производстве</option>
                  <option value={OrderStatus.READY_FOR_PICKUP}>Готов к выдаче</option>
                  <option value={OrderStatus.SHIPPED}>Отгружен</option>
                  <option value={OrderStatus.COMPLETED}>Завершен</option>
                </Select>
              </label>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                size="sm"
                className="sm:col-span-2"
                idleLabel="Сохранить производство"
                pendingLabel="Сохраняем..."
              />
            </form>
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Состав заказа
            </h2>
            <div className="mt-5 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {order.items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_90px_120px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">
                      {item.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {[item.sku, item.brand].filter(Boolean).join(" · ") ||
                        "Без артикула"}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    {item.quantity} шт.
                  </p>
                  <p className="font-medium text-[var(--foreground)] md:text-right">
                    {formatCurrency(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {order.comment ? (
            <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Комментарий к заказу
              </h2>
              <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                {order.comment}
              </pre>
            </section>
          ) : null}

          <OperationTimeline
            events={events}
            emptyMessage="История появится после подтверждения, запуска в производство, готовности к выдаче или смены менеджера."
          />
        </div>

        <div className="space-y-5">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Маршрут заказа
                </p>
                <h2 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                  До выдачи клиенту
                </h2>
              </div>
              {order.status === OrderStatus.CANCELED ? (
                <StatusBadge tone="neutral">Отменен</StatusBadge>
              ) : null}
            </div>
            <div className="mt-5">
              <OrderWorkflowTrail status={order.status} />
            </div>
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Управление заказом
            </h2>
            <form action={updateOrderAction} className="mt-5 grid gap-3">
              <input type="hidden" name="id" value={order.id} />
              <Select name="status" defaultValue={order.status}>
                {Object.values(OrderStatus).map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabels[status]}
                  </option>
                ))}
              </Select>
              <Select name="managerId" defaultValue={order.managerId ?? ""}>
                <option value="">Без менеджера</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {getManagerDisplayName(manager)}
                  </option>
                ))}
              </Select>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                idleLabel="Сохранить изменения"
                pendingLabel="Сохраняем..."
              />
            </form>

            {orderQuickTransitions[order.status].length > 0 ? (
              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                  Следующий шаг
                </p>
                <div className="mt-3 grid gap-2">
                  {orderQuickTransitions[order.status].map((transition) => (
                    <form key={transition.status} action={updateOrderAction}>
                      <input type="hidden" name="id" value={order.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={transition.status}
                      />
                      <input
                        type="hidden"
                        name="managerId"
                        value={order.managerId ?? ""}
                      />
                      <AdminSubmitButton
                        type="submit"
                        variant={
                          transition.intent === "accent" ? "accent" : "secondary"
                        }
                        size="sm"
                        className="w-full justify-center"
                        idleLabel={transition.label}
                        pendingLabel="Обновляем..."
                      />
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Заметки по заказу
            </h2>
            <form action={addOrderManagerNoteAction} className="mt-5 grid gap-3">
              <input type="hidden" name="orderId" value={order.id} />
              <Textarea
                name="body"
                rows={4}
                placeholder="Внутренняя заметка: оплата, комплектация, выдача, разговор с клиентом."
                required
              />
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  name="isVisibleToClient"
                  className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
                />
                Показать клиенту в кабинете
              </label>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                size="sm"
                idleLabel="Добавить заметку"
                pendingLabel="Добавляем..."
              />
            </form>

            {managerNotes.length > 0 ? (
              <div className="mt-5 space-y-3 border-t border-[color:var(--line)] pt-5">
                {managerNotes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-[var(--muted)]">
                        {note.authorName ?? "Менеджер"} · {formatDate(note.createdAt)}
                      </p>
                      <StatusBadge tone={note.isVisibleToClient ? "success" : "neutral"}>
                        {note.isVisibleToClient ? "Клиент видит" : "Внутренне"}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                      {note.body}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Заметок пока нет.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
