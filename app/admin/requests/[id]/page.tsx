import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";

import {
  RequestFileKind,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import {
  addRequestManagerNoteAction,
  createOrderFromRequestAction,
  updateRequestAction,
  updateRequestCuttingDetailsAction,
  updateRequestCuttingProgressAction,
  updateRequestProductionResultAction,
  uploadRequestResultFilesAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { CuttingProgress } from "@/components/cutting/cutting-progress";
import { OperationTimeline } from "@/components/admin/operation-timeline";
import { WhatsappClientLink } from "@/components/admin/whatsapp-client-link";
import { buildRequestWhatsappText } from "@/features/admin/whatsapp";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { GibLabProjectCode } from "@/components/admin/giblab-project-code";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  canAccessRequestType,
  canDeleteRequests,
  isCuttingManager,
} from "@/lib/auth/roles";
import { getOrdersForRequest } from "@/lib/server/order-inbox";
import { getOperationEvents } from "@/lib/server/operation-events";
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
import { cuttingStageSteps } from "@/features/cutting/progress";
import { getCuttingPrice } from "@/lib/server/cutting-pricing";
import { repriceCuttingRequestAction } from "@/app/admin/cutting/pricing/actions";

type AdminRequestDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pricingError?: string }>;
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
    timeZone: "Asia/Bishkek",
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

// Файлы, которые браузер не умеет показывать (проекты Базиса, чертежи,
// архивы), отдаём на скачивание: Vercel Blob делает это по ?download=1.
function getRequestFileHref(file: { fileName: string; fileUrl: string }) {
  const viewable = /\.(pdf|jpe?g|png|webp)$/i.test(file.fileName);

  return !viewable && /^https:\/\//.test(file.fileUrl)
    ? `${file.fileUrl}${file.fileUrl.includes("?") ? "&" : "?"}download=1`
    : file.fileUrl;
}

export default async function AdminRequestDetailPage({
  params,
  searchParams,
}: AdminRequestDetailPageProps) {
  const { id } = await params;
  const session = await requireAdminSession(
    "/login?next=/admin/requests",
    `/admin/requests/${id}`,
  );
  const [request, managers, linkedOrders, events] = await Promise.all([
    getRequestDetailById(id),
    getAdminManagers().catch(() => []),
    getOrdersForRequest(id),
    getOperationEvents("request", id),
  ]);

  if (!request || !canAccessRequestType(session.roleCode, request.type)) {
    notFound();
  }

  const cuttingManager = isCuttingManager(session.roleCode);
  const laborPrice =
    request.type === RequestType.CUTTING_SERVICE
      ? await getCuttingPrice(id)
      : null;
  const { pricingError } = await searchParams;
  const canDeleteRequest = canDeleteRequests(session.roleCode);
  const canCreateOrder =
    !cuttingManager &&
    request.status !== RequestStatus.CANCELED &&
    linkedOrders.length === 0;
  const clientFiles = request.files.filter(
    (file) =>
      (file.kind ?? RequestFileKind.CLIENT_UPLOAD) ===
      RequestFileKind.CLIENT_UPLOAD,
  );
  const resultFiles = request.files.filter(
    (file) => file.kind === RequestFileKind.MANAGER_RESULT,
  );
  const managerNotes = request.managerNotes ?? [];

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <SectionHeading
              title={request.number ?? request.id}
              description={
                cuttingManager
                  ? "Рабочая карточка распила: клиент, файлы, этап производства и готовность к выдаче."
                  : "Рабочая карточка менеджера: контакт клиента, материал, файлы, статус и перевод заявки в заказ."
              }
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
            {request.type === RequestType.CUTTING_SERVICE ? (
              <Link
                href={`/admin/requests/${request.id}/route-sheet`}
                className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--foreground)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-[var(--accent)]"
              >
                <Printer className="size-4" />
                Маршрутный лист
              </Link>
            ) : null}
            <Link
              href={cuttingManager ? "/admin/cutting" : "/admin/requests"}
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              {cuttingManager ? "К очереди распила" : "К очереди заявок"}
            </Link>
            {canDeleteRequest ? (
              <DeleteRequestButton
                requestId={request.id}
                requestNumber={request.number ?? request.id.slice(0, 8)}
                returnTo="/admin/requests"
              />
            ) : null}
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
                <WhatsappClientLink
                  className="mt-2"
                  phone={request.contactPhone}
                  text={buildRequestWhatsappText({
                    number: request.number,
                    contactName: request.contactName,
                    statusLabel: requestStatusLabels[request.status],
                    isCutting: request.type === RequestType.CUTTING_SERVICE,
                    isReady: request.cuttingStage === "READY_FOR_PICKUP",
                  })}
                />
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
                  Листов: {request.cuttingSheetCount ?? "не указано"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Кромка, м: {request.cuttingEdgeMeters ?? "не указано"}
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

            {request.type === RequestType.CUTTING_SERVICE ? (
              <form
                action={updateRequestCuttingDetailsAction}
                className="mt-5 grid gap-3 border-t border-[color:var(--line)] pt-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.4fr)_minmax(0,1fr)_minmax(9rem,0.4fr)_auto] xl:items-end"
              >
                <input type="hidden" name="requestId" value={request.id} />
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Материалы / листы
                  <Input
                    name="material"
                    defaultValue={request.material ?? ""}
                    maxLength={500}
                    required
                    placeholder="МДФ 18 мм, Albero A-01"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Количество листов
                  <Input
                    name="cuttingSheetCount"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    inputMode="numeric"
                    defaultValue={request.cuttingSheetCount ?? ""}
                    placeholder="12"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Кромка
                  <Input
                    name="edgeOption"
                    defaultValue={request.edgeOption ?? ""}
                    maxLength={240}
                    placeholder="Например: 0,8 × 22 мм, белая, код 101"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Кромка, пог. м
                  <Input
                    name="cuttingEdgeMeters"
                    type="number"
                    min={0}
                    max={100000}
                    step={0.1}
                    inputMode="decimal"
                    defaultValue={request.cuttingEdgeMeters ?? ""}
                    placeholder="48,5"
                  />
                </label>
                <AdminSubmitButton
                  type="submit"
                  variant="secondary"
                  size="sm"
                  idleLabel="Сохранить материалы"
                  pendingLabel="Сохраняем..."
                />
              </form>
            ) : null}

            {request.message ? (
              <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                  Комментарий и расчет
                </p>
                <pre className="mt-3 text-sm leading-7 whitespace-pre-wrap text-[var(--foreground)]">
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
                {clientFiles.length > 0
                  ? `${clientFiles.length} от клиента`
                  : "Файлы пока не приложены"}
              </p>
            </div>

            <div className="mt-4 empty:hidden">
              <GibLabProjectCode
                requestId={request.id}
                files={request.files}
                clientName={request.contactName}
              />
            </div>

            {clientFiles.length > 0 ? (
              <div className="mt-5 space-y-3">
                {clientFiles.map((file) => (
                  <div key={file.id} className="grid gap-2">
                    <a
                      href={getRequestFileHref(file)}
                      target="_blank"
                      rel="noreferrer"
                      download={file.fileName}
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
                    {/\.b3d$/i.test(file.fileName) ? (
                      <Link
                        href={`/admin/requests/${request.id}/bazis/${file.id}`}
                        className="inline-flex h-10 items-center justify-center bg-[var(--foreground)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                      >
                        Открыть проект Базиса: макет и список деталей
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Клиент не приложил файл. Менеджер может работать по текстовым
                параметрам или запросить вложение дополнительно.
              </p>
            )}
          </section>

          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Результат распила
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Карта раскроя, ведомость, PDF/Excel или файл Giblab для
                  клиента.
                </p>
              </div>
              {request.quotedTotal != null ? (
                <StatusBadge tone="accent">
                  {formatBudget(request.quotedTotal)}
                </StatusBadge>
              ) : null}
            </div>

            {request.type === RequestType.CUTTING_SERVICE ? (
              <div className="mt-6 grid gap-6 border-t border-[color:var(--line)] pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,1.1fr)]">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                    Трекинг производства
                  </p>
                  <div className="mt-4">
                    <CuttingProgress
                      stage={request.cuttingStage}
                      pickupCell={request.cuttingPickupCell}
                      updatedAt={request.cuttingStageUpdatedAt}
                    />
                  </div>
                </div>

                <form
                  action={updateRequestCuttingProgressAction}
                  className="grid content-start gap-3"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <input
                    type="hidden"
                    name="expectedStage"
                    value={request.cuttingStage ?? ""}
                  />
                  <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                    Текущий этап
                    <Select
                      name="cuttingStage"
                      defaultValue={request.cuttingStage ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Выберите этап распила
                      </option>
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
                      maxLength={64}
                      placeholder="Например: A-12"
                    />
                    <span className="text-xs font-normal text-[var(--muted)]">
                      Укажите для этапа «Готов к выдаче».
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                    Комментарий клиенту
                    <Textarea
                      name="cuttingStageNote"
                      rows={2}
                      placeholder="Необязательно: уточнение по готовности или выдаче."
                    />
                  </label>
                  <AdminSubmitButton
                    type="submit"
                    variant="accent"
                    size="sm"
                    idleLabel="Обновить этап и уведомить"
                    pendingLabel="Обновляем..."
                  />
                </form>
              </div>
            ) : null}

            {request.type === RequestType.CUTTING_SERVICE ? (
              <div className="mt-5 space-y-3 border-y border-[color:var(--line)] py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    Стоимость работ: {formatBudget(request.quotedTotal ?? null)}
                  </h3>
                  <Link
                    href="/admin/cutting/pricing"
                    className="text-sm underline"
                  >
                    Прайс работ
                  </Link>
                </div>
                {laborPrice ? (
                  <p className="text-sm text-[var(--muted)]">
                    Распил: {laborPrice.sheetRate} сом/лист · Кромление:{" "}
                    {laborPrice.edgeRate} сом/м
                  </p>
                ) : null}
                {pricingError ? (
                  <p role="alert" className="text-sm text-red-700">
                    {pricingError}
                  </p>
                ) : null}
                <form action={repriceCuttingRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <AdminSubmitButton
                    type="submit"
                    variant="secondary"
                    size="sm"
                    idleLabel={
                      laborPrice
                        ? "Пересчитать по текущему прайсу"
                        : "Рассчитать по прайсу"
                    }
                    pendingLabel="Считаем..."
                  />
                </form>
              </div>
            ) : null}
            <form
              action={updateRequestProductionResultAction}
              className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Итог, KGS
                <Input
                  name="quotedTotal"
                  type="number"
                  min={0}
                  defaultValue={request.quotedTotal ?? ""}
                  readOnly={Boolean(laborPrice)}
                  placeholder="0"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Комментарий производства
                <Textarea
                  name="productionComment"
                  defaultValue={request.productionComment ?? ""}
                  rows={3}
                  placeholder="Что входит в расчет, сроки, важные ограничения."
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)] sm:col-span-2">
                Статус после сохранения
                <Select name="status" defaultValue="">
                  <option value="">Не менять статус</option>
                  <option value={RequestStatus.QUOTE_SENT}>
                    КП отправлено
                  </option>
                  <option value={RequestStatus.IN_PROGRESS}>В работе</option>
                  <option value={RequestStatus.COMPLETED}>Завершена</option>
                </Select>
              </label>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                size="sm"
                className="sm:col-span-2"
                idleLabel="Сохранить результат"
                pendingLabel="Сохраняем..."
              />
            </form>

            <form
              action={uploadRequestResultFilesAction}
              className="mt-5 grid gap-3 border-t border-[color:var(--line)] pt-5"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Файлы результата
                <Input
                  name="files"
                  type="file"
                  multiple
                  accept=".pdf,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip,.rar,.jpg,.jpeg,.png,.webp,.heic,.dwg,.dxf,.project,.b3d,.bpr,.sto,.xml"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Примечание к файлам
                <Input
                  name="note"
                  placeholder="Например: карта раскроя и ведомость для цеха"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  name="isVisibleToClient"
                  defaultChecked
                  className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
                />
                Показать эти файлы клиенту в личном кабинете
              </label>
              <AdminSubmitButton
                type="submit"
                variant="accent"
                size="sm"
                idleLabel="Прикрепить файлы"
                pendingLabel="Загружаем..."
              />
            </form>

            {resultFiles.length > 0 ? (
              <div className="mt-5 space-y-3">
                {resultFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3 transition hover:border-[color:var(--line-strong)]"
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium text-[var(--foreground)]">
                      {file.fileName}
                      {file.isVisibleToClient ? (
                        <StatusBadge tone="success">Виден клиенту</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Внутренний</StatusBadge>
                      )}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {file.size
                        ? `${Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} МБ`
                        : "Размер не указан"}{" "}
                      · {formatDate(file.createdAt)}
                    </span>
                    {file.note ? (
                      <span className="text-xs text-[var(--muted)]">
                        {file.note}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : null}
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
                          transition.intent === "accent"
                            ? "accent"
                            : "secondary"
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
              Заметки менеджера
            </h2>
            <form
              action={addRequestManagerNoteAction}
              className="mt-5 grid gap-3"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <Textarea
                name="body"
                rows={4}
                placeholder="Внутренняя заметка: звонок, договоренность, уточнение по файлу."
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
                        {note.authorName ?? "Менеджер"} ·{" "}
                        {formatDate(note.createdAt)}
                      </p>
                      <StatusBadge
                        tone={note.isVisibleToClient ? "success" : "neutral"}
                      >
                        {note.isVisibleToClient ? "Клиент видит" : "Внутренне"}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-[var(--foreground)]">
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

          {!cuttingManager ? (
            <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Перевод в заказ
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                После расчета и подтверждения можно автоматически создать заказ.
                Контакты, материал, комментарий и ссылки на файлы будут
                перенесены в заказ.
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
                          ? (orderStatusLabels[
                              order.status as keyof typeof orderStatusLabels
                            ] ?? order.status)
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
          ) : null}

          <OperationTimeline
            events={events}
            emptyMessage="История появится после первого изменения статуса, назначения менеджера или создания заказа из заявки."
          />
        </div>
      </section>
    </div>
  );
}
