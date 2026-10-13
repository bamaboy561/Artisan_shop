import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  MapPin,
  Phone,
  Printer,
  UserRound,
} from "lucide-react";

import {
  advanceProductionStageAction,
  markCuttingRequestIssuedAction,
  setProductionStageAction,
  uploadRequestResultFilesAction,
} from "@/app/admin/actions";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { OperationTimeline } from "@/components/admin/operation-timeline";
import { StatusBadge } from "@/components/admin/status-badge";
import { CuttingProgress } from "@/components/cutting/cutting-progress";
import { getButtonClassName } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CuttingStage,
  OrderStatus,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import { cuttingStageSteps } from "@/features/cutting/progress";
import { getProductionTransition } from "@/features/production/workflow";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  canManageProduction,
  canDeleteRequests,
  isProductionOperator,
  productionStationDefinitions,
} from "@/lib/auth/roles";
import { getOperationEvents } from "@/lib/server/operation-events";
import { getOrdersForRequest } from "@/lib/server/order-inbox";
import { getRequestDetailById } from "@/lib/server/request-inbox";
import { saveProductionDeadlineAction } from "@/app/admin/production/actions";
import {
  getDemoPlanningEvents,
  getProductionPlans,
  productionPlanningAvailable,
} from "@/lib/server/production-planning";
import {
  productionTimeZone,
  safeProductionReturn,
} from "@/features/production/queue";

export const dynamic = "force-dynamic";

type ProductionRequestPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const noticeMessages: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  "stage-updated": {
    tone: "success",
    text: "Этап сохранен.",
  },
  "stage-conflict": {
    tone: "error",
    text: "Этап уже изменился на другом устройстве. Данные обновлены.",
  },
  "pickup-cell-required": {
    tone: "error",
    text: "Укажите номер ячейки перед завершением производства.",
  },
  "action-forbidden": {
    tone: "error",
    text: "Для этого аккаунта действие недоступно.",
  },
  "request-missing": {
    tone: "error",
    text: "Производственная заявка не найдена.",
  },
  "deadline-saved": { tone: "success", text: "Плановая готовность сохранена." },
  issued: { tone: "success", text: "Заказ отмечен как выданный." },
  "not-launched": {
    tone: "error",
    text: "Заявка ещё не запущена в производство. Дождитесь менеджера.",
  },
  "deadline-conflict": {
    tone: "error",
    text: "Срок уже изменён другим сотрудником. Проверьте обновлённую дату.",
  },
  "deadline-invalid": {
    tone: "error",
    text: "Укажите корректную дату от 2000 до 2100 года.",
  },
  "deadline-forbidden": {
    tone: "error",
    text: "Изменять срок может только менеджер.",
  },
  "deadline-closed": {
    tone: "error",
    text: "Заявка закрыта или удалена. Срок не изменён.",
  },
  "deadline-unavailable": {
    tone: "error",
    text: "Срок не сохранён. Хранилище планирования недоступно.",
  },
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: productionTimeZone,
  }).format(value instanceof Date ? value : new Date(value));
}

export default async function ProductionRequestPage({
  params,
  searchParams,
}: ProductionRequestPageProps) {
  const { id } = await params;
  const session = await requireAdminSession(
    `/login?next=/admin/production/${encodeURIComponent(id)}`,
    `/admin/production/${id}`,
  );
  const [request, events, resolvedSearchParams] = await Promise.all([
    getRequestDetailById(id),
    getOperationEvents("request", id),
    searchParams,
  ]);

  if (!request || request.type !== RequestType.CUTTING_SERVICE) {
    notFound();
  }

  const requestNumber = request.number ?? request.id.slice(0, 8).toUpperCase();
  const operator = isProductionOperator(session.roleCode);
  const manager = canManageProduction(session.roleCode);
  // Распил оплачивается через заказ: показываем, оплачен ли он, до выдачи.
  const linkedOrders =
    manager && request.cuttingStage === CuttingStage.READY_FOR_PICKUP
      ? await getOrdersForRequest(request.id)
      : [];
  const unpaidOrders = linkedOrders.filter(
    (order) =>
      order.status === OrderStatus.NEW ||
      order.status === OrderStatus.RESERVED ||
      order.status === OrderStatus.CONFIRMED,
  );
  const issueWarning =
    linkedOrders.length === 0
      ? "По заявке нет заказа на оплату."
      : unpaidOrders.length > 0
        ? `Заказ № ${unpaidOrders.map((order) => order.number ?? "без номера").join(", ")} не оплачен.`
        : "";
  const canDeleteRequest = canDeleteRequests(session.roleCode);
  const transition =
    operator && session.productionStation
      ? getProductionTransition(session.productionStation, request.cuttingStage)
      : null;
  const isClosed = new Set<RequestStatus>([
    RequestStatus.CANCELED,
    RequestStatus.COMPLETED,
  ]).has(request.status);
  const notice = noticeMessages[getSearchValue(resolvedSearchParams, "notice")];
  const returnTo = safeProductionReturn(
    getSearchValue(resolvedSearchParams, "returnTo"),
  );
  const planning = await productionPlanningAvailable();
  const plan = planning ? (await getProductionPlans([id])).get(id) : undefined;
  const timelineEvents = [...events, ...(await getDemoPlanningEvents(id))].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="min-w-0 space-y-4 [&_*]:tracking-normal [&_section]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnTo}
          className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
        >
          <ArrowLeft className="size-4" />К очереди
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {manager ? (
            <ButtonLink
              href={`/admin/requests/${request.id}/route-sheet`}
              variant="secondary"
            >
              <Printer className="size-4" />
              Маршрутный лист
            </ButtonLink>
          ) : null}
          {canDeleteRequest ? (
            <DeleteRequestButton
              requestId={request.id}
              requestNumber={requestNumber}
              returnTo="/admin/production"
            />
          ) : null}
        </div>
      </div>

      {notice ? (
        <p
          className={
            notice.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      ) : null}

      <section className="border-y border-[color:var(--line)] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
              Производственный заказ
            </p>
            <h1 className="mt-1 text-2xl font-bold break-words text-[var(--foreground)]">
              {requestNumber}
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-6 font-medium break-words text-[var(--foreground)]">
              {request.material || request.subject}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {operator && session.productionStation ? (
              <StatusBadge tone="accent">
                {productionStationDefinitions[session.productionStation].label}
              </StatusBadge>
            ) : null}
            <StatusBadge tone={isClosed ? "neutral" : "success"}>
              {isClosed ? "Заявка закрыта" : "В производстве"}
            </StatusBadge>
          </div>
        </div>

        {operator ? (
          <div className="mt-4 space-y-2 text-sm lg:hidden">
            <p className="font-medium">{request.contactName}</p>
            <p>
              {request.cuttingSheetCount ?? "—"} лист. ·{" "}
              {request.cuttingEdgeMeters ?? "—"} м кромки
            </p>
            {request.edgeOption ? <p>{request.edgeOption}</p> : null}
          </div>
        ) : null}
        <div
          className={`${operator ? "hidden lg:grid" : "grid"} mt-4 gap-4 border-t border-[color:var(--line)] pt-4 sm:grid-cols-2 xl:grid-cols-3 [&_div]:min-w-0 [&_p]:break-words`}
        >
          <div>
            <p className="text-xs text-[var(--muted)]">Клиент</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-[var(--foreground)]">
              <UserRound className="size-4 text-[var(--accent)]" />
              {request.contactName}
            </p>
          </div>
          {/* Телефон клиента оператору не нужен: связь с клиентом ведёт
              менеджер. Не отдаём его в страницу вовсе, а не прячем стилем. */}
          {operator ? null : (
            <div>
              <p className="text-xs text-[var(--muted)]">Телефон</p>
              <a
                href={`tel:${request.contactPhone}`}
                className="mt-1 flex items-center gap-2 font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
              >
                <Phone className="size-4 text-[var(--accent)]" />
                {request.contactPhone}
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-[var(--muted)]">Количество листов</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {request.cuttingSheetCount
                ? `${request.cuttingSheetCount} шт.`
                : "Не указано"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Кромка</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {request.edgeOption || "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Кромка, пог. м</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {request.cuttingEdgeMeters
                ? `${request.cuttingEdgeMeters.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м`
                : "Не указано"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Создан</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {formatDate(request.createdAt)}
            </p>
          </div>
        </div>

        {planning ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[color:var(--line)] pt-3 text-sm">
            <span className="text-[var(--muted)]">Плановая готовность:</span>
            <strong>
              {plan?.dueDate
                ? plan.dueDate.split("-").reverse().join(".")
                : "Не назначена"}
            </strong>
          </div>
        ) : null}
        {request.message ? (
          <div className="mt-5 border-t border-[color:var(--line)] pt-5">
            <p className="text-xs text-[var(--muted)]">Комментарий к распилу</p>
            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[var(--foreground)]">
              {request.message}
            </p>
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="order-2 border-t border-[color:var(--line)] bg-white p-4 sm:p-5 xl:order-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Маршрут производства
          </h2>
          <div className="mt-5">
            <CuttingProgress
              stage={request.cuttingStage ?? CuttingStage.ACCEPTED}
              pickupCell={request.cuttingPickupCell}
              updatedAt={request.cuttingStageUpdatedAt}
            />
          </div>
        </section>

        <section className="order-1 border-t-2 border-emerald-700 bg-white p-4 sm:p-5 xl:order-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {transition ? transition.label : "Действие станции"}
          </h2>

          {isClosed ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              Закрытую или отмененную заявку нельзя перемещать по производству.
            </p>
          ) : operator && transition ? (
            <form
              action={advanceProductionStageAction}
              className="mt-5 grid gap-4"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              {transition.requiresPickupCell ? (
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Ячейка выдачи
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input
                      name="cuttingPickupCell"
                      defaultValue={request.cuttingPickupCell ?? ""}
                      placeholder="Например, A-12"
                      className="pl-10 sm:pl-10"
                      required
                    />
                  </div>
                </label>
              ) : null}
              <details>
                <summary className="cursor-pointer py-2 text-sm font-medium">
                  Комментарий
                </summary>
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  <span className="sr-only">Комментарий станции</span>
                  <Textarea
                    name="cuttingStageNote"
                    placeholder="Виден только сотрудникам, клиенту не уходит"
                    rows={3}
                  />
                </label>
              </details>
              <AdminSubmitButton
                type="submit"
                variant="accent"
                size="lg"
                idleLabel={transition.label}
                pendingLabel="Сохраняем..."
                className="w-full"
              />
            </form>
          ) : operator ? (
            <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Этот заказ сейчас находится на другой станции. Этап можно
              просмотреть, но изменить его с этого аккаунта нельзя.
            </div>
          ) : manager ? (
            <form action={setProductionStageAction} className="mt-5 grid gap-4">
              <input type="hidden" name="requestId" value={request.id} />
              <input
                type="hidden"
                name="expectedStage"
                value={request.cuttingStage ?? ""}
              />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Этап
                <Select
                  name="cuttingStage"
                  defaultValue={request.cuttingStage ?? CuttingStage.ACCEPTED}
                >
                  {cuttingStageSteps.map((step) => (
                    <option key={step.stage} value={step.stage}>
                      {step.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Ячейка выдачи
                <Input
                  name="cuttingPickupCell"
                  defaultValue={request.cuttingPickupCell ?? ""}
                  placeholder="Заполняется для готового заказа"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Комментарий клиенту
                <Textarea
                  name="cuttingStageNote"
                  placeholder="Например, заказ передан на следующую станцию"
                  rows={3}
                />
              </label>
              <AdminSubmitButton
                type="submit"
                variant="accent"
                idleLabel="Сохранить этап"
                pendingLabel="Сохраняем..."
              />
            </form>
          ) : null}
        </section>
      </div>

      {manager &&
      !isClosed &&
      request.cuttingStage === CuttingStage.READY_FOR_PICKUP ? (
        <section className="border-y border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Выдача заказа</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Заказ готов
            {request.cuttingPickupCell
              ? ` и лежит в ячейке ${request.cuttingPickupCell}`
              : ""}
            . Когда клиент его заберёт, нажмите «Выдано»: заявка закроется и
            уйдёт из очереди.
          </p>
          {linkedOrders.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-orange-800">
              По этой заявке ещё не создан заказ на оплату.
            </p>
          ) : unpaidOrders.length > 0 ? (
            <p className="mt-2 text-sm font-semibold text-red-700">
              Заказ №{" "}
              {unpaidOrders
                .map((order) => order.number ?? "без номера")
                .join(", ")}{" "}
              не оплачен.
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium text-emerald-800">
              Заказ оплачен. После выдачи он сам станет «Завершён».
            </p>
          )}
          <form action={markCuttingRequestIssuedAction} className="mt-3">
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            {issueWarning ? (
              <ConfirmDeleteButton
                confirmMessage={`${issueWarning} Всё равно отметить заявку выданной?`}
                className={getButtonClassName("accent", "md")}
              >
                Выдано
              </ConfirmDeleteButton>
            ) : (
              <AdminSubmitButton
                type="submit"
                variant="accent"
                idleLabel="Выдано"
                pendingLabel="Сохраняем..."
              />
            )}
          </form>
        </section>
      ) : null}

      {manager && !isClosed ? (
        <section className="border-y border-[color:var(--line)] bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold">Плановая готовность</h2>
          {planning ? (
            <form
              action={saveProductionDeadlineAction}
              className="mt-3 flex flex-wrap items-end gap-3"
              key={`${request.id}/${plan?.version ?? 0}`}
            >
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="version" value={plan?.version ?? 0} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="grid min-w-0 flex-[1_1_180px] gap-2 text-sm sm:max-w-xs">
                Дата готовности
                <Input
                  type="date"
                  name="dueDate"
                  min="2000-01-01"
                  max="2100-12-31"
                  defaultValue={plan?.dueDate ?? ""}
                  className="min-w-0"
                />
              </label>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                idleLabel="Сохранить срок"
                pendingLabel="Сохраняем..."
              />
            </form>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Планирование сроков ещё не подключено.
            </p>
          )}
        </section>
      ) : null}

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Файлы производства
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Карты раскроя, ведомости и результаты Giblab.
            </p>
          </div>
          <StatusBadge tone="neutral">
            Файлов: {request.files.length}
          </StatusBadge>
        </div>

        {request.files.length > 0 ? (
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {request.files.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] px-4 py-3 transition hover:border-[color:var(--foreground)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                    {file.fileName}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {formatDate(file.createdAt)}
                  </span>
                </span>
                <Download className="size-4 shrink-0" />
              </a>
            ))}
            {!operator
              ? request.files
                  .filter((file) => /\.b3d$/i.test(file.fileName))
                  .map((file) => (
                    <Link
                      key={`labels-${file.id}`}
                      href={`/admin/requests/${request.id}/bazis/${file.id}/labels`}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface)]"
                    >
                      <span className="truncate">
                        Этикетки с QR для сборки · {file.fileName}
                      </span>
                    </Link>
                  ))
              : null}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[var(--muted)]">
            Файлы к этой заявке еще не приложены.
          </p>
        )}

        {manager ? (
          <form
            action={uploadRequestResultFilesAction}
            className="mt-6 grid gap-4 border-t border-[color:var(--line)] pt-5"
          >
            <input type="hidden" name="requestId" value={request.id} />
            <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
              Добавить файлы результата
              <Input
                name="files"
                type="file"
                multiple
                required
                accept=".pdf,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip,.rar,.jpg,.jpeg,.png,.webp,.heic,.dwg,.dxf,.project,.b3d,.bpr,.sto,.xml"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
              Примечание к файлам
              <Input
                name="note"
                placeholder="Например, карта раскроя из Giblab"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                name="isVisibleToClient"
                className="size-4 accent-[var(--accent)]"
                defaultChecked
              />
              Показывать клиенту в личном кабинете
            </label>
            <AdminSubmitButton
              type="submit"
              variant="secondary"
              idleLabel="Загрузить файлы"
              pendingLabel="Загружаем..."
              className="justify-self-start"
            />
          </form>
        ) : null}
      </section>

      <details className="border-t border-[color:var(--line)] pt-4">
        <summary className="cursor-pointer py-2 text-base font-semibold">
          Журнал действий ({timelineEvents.length})
        </summary>
        <OperationTimeline
          events={timelineEvents}
          emptyMessage="Действия по этой заявке еще не записывались."
        />
      </details>
    </div>
  );
}
