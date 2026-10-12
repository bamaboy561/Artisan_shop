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
  setProductionStageAction,
  uploadRequestResultFilesAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";
import { OperationTimeline } from "@/components/admin/operation-timeline";
import { StatusBadge } from "@/components/admin/status-badge";
import { CuttingProgress } from "@/components/cutting/cutting-progress";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CuttingStage, RequestStatus, RequestType } from "@/generated/prisma";
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
import { getRequestDetailById } from "@/lib/server/request-inbox";

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
    text: "Этап сохранен. Клиенту отправлено уведомление.",
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/production"
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

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
              Производственный заказ
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[var(--foreground)]">
              {requestNumber}
            </h1>
            <p className="mt-2 max-w-3xl text-lg leading-7 font-medium text-[var(--foreground)]">
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

        <div className="mt-6 grid gap-5 border-t border-[color:var(--line)] pt-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Клиент</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-[var(--foreground)]">
              <UserRound className="size-4 text-[var(--accent)]" />
              {request.contactName}
            </p>
          </div>
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
          <div>
            <p className="text-xs text-[var(--muted)]">Кромка</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {request.edgeOption || "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Создан</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {formatDate(request.createdAt)}
            </p>
          </div>
        </div>

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
        <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
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

        <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Действие станции
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
              {transition.requiresPickupCell ? (
                <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                  Ячейка выдачи
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input
                      name="cuttingPickupCell"
                      defaultValue={request.cuttingPickupCell ?? ""}
                      placeholder="Например, A-12"
                      className="pl-10"
                      required
                    />
                  </div>
                </label>
              ) : null}
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                Комментарий
                <Textarea
                  name="cuttingStageNote"
                  placeholder="Необязательно"
                  rows={3}
                />
              </label>
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
                accept=".pdf,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png,.webp,.dwg,.dxf,.project"
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

      <OperationTimeline
        events={events}
        emptyMessage="Действия по этой заявке еще не записывались."
      />
    </div>
  );
}
