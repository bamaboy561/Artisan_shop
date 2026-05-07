import Link from "next/link";
import { notFound } from "next/navigation";

import { RequestStatus } from "@/generated/prisma";
import {
  createOrderFromRequestAction,
  updateRequestAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminSession } from "@/lib/auth/dal";
import { getOrdersForRequest } from "@/lib/server/order-inbox";
import { getAdminManagers } from "@/lib/server/operations-admin";
import { getRequestDetailById } from "@/lib/server/request-inbox";
import {
  getManagerDisplayName,
  orderStatusLabels,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import {
  requestQuickTransitions,
  requestWorkflowSteps,
} from "@/features/admin/workflow";
import { cn } from "@/lib/utils";

type AdminRequestDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatBudget(value: number | null) {
  if (value === null) {
    return "Не указан";
  }

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

function getStatusTone(status: RequestStatus) {
  switch (status) {
    case RequestStatus.NEW:
    case RequestStatus.IN_REVIEW:
      return "warning" as const;
    case RequestStatus.QUOTE_SENT:
    case RequestStatus.WAITING_FOR_CLIENT:
    case RequestStatus.IN_PROGRESS:
      return "accent" as const;
    case RequestStatus.COMPLETED:
      return "success" as const;
    case RequestStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

function RequestWorkflowTrail({ status }: { status: RequestStatus }) {
  const currentIndex = requestWorkflowSteps.findIndex(
    (step) => step.status === status,
  );
  const isCanceled = status === RequestStatus.CANCELED;

  return (
    <div className="grid gap-3">
      {requestWorkflowSteps.map((step, index) => {
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

export default async function AdminRequestDetailPage({
  params,
}: AdminRequestDetailPageProps) {
  await requireAdminSession("/login?next=/admin/requests");

  const { id } = await params;
  const [request, managers, linkedOrders] = await Promise.all([
    getRequestDetailById(id),
    getAdminManagers().catch(() => []),
    getOrdersForRequest(id),
  ]);

  if (!request) {
    notFound();
  }

  const canCreateOrder =
    request.status !== RequestStatus.CANCELED && linkedOrders.length === 0;

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <SectionHeading
              title={request.number ?? request.id}
              description="Рабочая карточка менеджера: контакт клиента, материал, файлы, статус и перевод заявки в заказ."
              titleClassName="text-2xl sm:text-3xl"
              descriptionClassName="max-w-2xl text-sm leading-7"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={getStatusTone(request.status)}>
                {requestStatusLabels[request.status]}
              </StatusBadge>
              <StatusBadge tone={request.managerId ? "neutral" : "warning"}>
                {request.manager
                  ? getManagerDisplayName(request.manager)
                  : "Без менеджера"}
              </StatusBadge>
              <StatusBadge tone="neutral">
                {request._count.files > 0
                  ? `Файлов: ${request._count.files}`
                  : "Без файлов"}
              </StatusBadge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/requests"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              К очереди заявок
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Контакты и параметры
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Клиент
                </p>
                <p className="mt-2 font-medium text-[var(--foreground)]">
                  {request.contactName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {request.contactPhone}
                </p>
                {request.contactEmail ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {request.contactEmail}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Материал и бюджет
                </p>
                <p className="mt-2 font-medium text-[var(--foreground)]">
                  {request.material ?? "Не указан"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Кромка: {request.edgeOption ?? "Уточнить"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Ориентир: {formatBudget(request.estimatedBudget)}
                </p>
              </div>

              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Создана
                </p>
                <p className="mt-2 text-sm text-[var(--foreground)]">
                  {formatDate(request.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Доставка
                </p>
                <p className="mt-2 text-sm text-[var(--foreground)]">
                  {request.deliveryNeeded
                    ? request.addressText || "Нужна, адрес уточняется"
                    : "Самовывоз / не требуется"}
                </p>
              </div>
            </div>

            {request.message ? (
              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Комментарий и расчет
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                  {request.message}
                </pre>
              </div>
            ) : null}
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Файлы заявки
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {request.files.length > 0
                  ? `${request.files.length} вложений`
                  : "Файлы пока не приложены"}
              </p>
            </div>

            {request.files.length > 0 ? (
              <div className="mt-5 space-y-3">
                {request.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3 transition hover:border-[color:var(--line-strong)]"
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {file.fileName}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {file.size
                        ? `${Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} МБ`
                        : "Размер не указан"}{" "}
                      · {formatDate(file.createdAt)}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Клиент не приложил файл. Менеджер может работать по текстовым параметрам
                или запросить вложение дополнительно.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Маршрут заявки
                </p>
                <h2 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                  От обращения до заказа
                </h2>
              </div>
              {request.status === RequestStatus.CANCELED ? (
                <StatusBadge tone="neutral">Отменена</StatusBadge>
              ) : null}
            </div>
            <div className="mt-5">
              <RequestWorkflowTrail status={request.status} />
            </div>
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Быстрое управление
            </h2>
            <form action={updateRequestAction} className="mt-5 grid gap-3">
              <input type="hidden" name="id" value={request.id} />
              <Select name="status" defaultValue={request.status}>
                {Object.values(RequestStatus).map((status) => (
                  <option key={status} value={status}>
                    {requestStatusLabels[status]}
                  </option>
                ))}
              </Select>
              <Select name="managerId" defaultValue={request.managerId ?? ""}>
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

            {requestQuickTransitions[request.status].length > 0 ? (
              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                  Следующий шаг
                </p>
                <div className="mt-3 grid gap-2">
                  {requestQuickTransitions[request.status].map((transition) => (
                    <form key={transition.status} action={updateRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={transition.status}
                      />
                      <input
                        type="hidden"
                        name="managerId"
                        value={request.managerId ?? ""}
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
              Перевод в заказ
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              После расчета и подтверждения можно автоматически создать заказ. Контакты,
              материал, комментарий и ссылки на файлы будут перенесены в заказ.
            </p>

            {linkedOrders.length > 0 ? (
              <div className="mt-5 space-y-2">
                {linkedOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3 transition hover:border-[color:var(--line-strong)]"
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {order.number ?? order.id}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {typeof order.status === "string"
                        ? orderStatusLabels[order.status as keyof typeof orderStatusLabels] ??
                          order.status
                        : "В работе"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            {canCreateOrder ? (
              <form action={createOrderFromRequestAction} className="mt-5">
                <input type="hidden" name="requestId" value={request.id} />
                <AdminSubmitButton
                  type="submit"
                  variant="accent"
                  idleLabel="Создать заказ из заявки"
                  pendingLabel="Создаем заказ..."
                />
              </form>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Для этой заявки заказ уже создан или она отменена.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
