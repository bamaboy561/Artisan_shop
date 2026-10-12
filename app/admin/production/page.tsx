import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Factory,
  FileStack,
  Layers3,
  UserRound,
} from "lucide-react";

import { ProductionQrSearch } from "@/app/admin/production/production-qr-search";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { CuttingStage } from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  canManageProduction,
  isProductionOperator,
  productionStationDefinitions,
} from "@/lib/auth/roles";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getProductionQueue } from "@/lib/server/production-workspace";

export const dynamic = "force-dynamic";

type ProductionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const noticeMessages: Record<string, string> = {
  "request-missing": "Производственная заявка не найдена.",
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getStageTone(stage: CuttingStage | null) {
  if (stage === CuttingStage.READY_FOR_PICKUP) return "success" as const;
  if (stage === CuttingStage.ACCEPTED || !stage) return "neutral" as const;
  return "warning" as const;
}

export default async function ProductionPage({
  searchParams,
}: ProductionPageProps) {
  const session = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );

  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Производственная очередь появится после подключения БД"
        description="Для этапов, QR и журнала действий нужна рабочая база заявок."
        steps={[
          "Настройте DATABASE_URL.",
          "Примените Prisma-схему.",
          "Откройте рабочее место производства повторно.",
        ]}
      />
    );
  }

  const operator = isProductionOperator(session.roleCode);
  const station = operator ? session.productionStation : null;

  if (operator && !station) {
    return (
      <SetupState
        title="Для аккаунта не выбрана станция"
        description="Администратор должен назначить этому оператору распил, кромку или присадку в разделе сотрудников."
        steps={[
          "Откройте Сотрудники под аккаунтом администратора.",
          "Выберите станцию для этого оператора.",
          "Сохраните роль и войдите снова.",
        ]}
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams, "q");
  const notice = noticeMessages[getSearchValue(resolvedSearchParams, "notice")];
  const queue = await getProductionQueue({ query, station });
  const workspaceTitle = station
    ? productionStationDefinitions[station].label
    : canManageProduction(session.roleCode)
      ? "Все станции производства"
      : "Производство";

  return (
    <div className="space-y-5">
      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center bg-[var(--foreground)] text-white">
              <Factory className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                Рабочее место
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                {workspaceTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                QR открывает маршрутный лист заказа. Все изменения этапа
                записываются в журнал и отправляются клиенту.
              </p>
            </div>
          </div>
          <StatusBadge tone="accent">В очереди: {queue.total}</StatusBadge>
        </div>
      </section>

      {notice ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notice}
        </p>
      ) : null}

      <ProductionQrSearch initialQuery={queue.query} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Производственная очередь
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {query
                ? `Найдено по запросу «${query}»: ${queue.total}`
                : `Активных заявок: ${queue.total}`}
            </p>
          </div>
          {queue.total > queue.items.length ? (
            <p className="text-xs text-[var(--muted)]">
              Показаны первые {queue.items.length}. Уточните поиск.
            </p>
          ) : null}
        </div>

        {queue.items.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {queue.items.map((request) => {
              const stage = request.cuttingStage ?? CuttingStage.ACCEPTED;
              const requestNumber =
                request.number ?? request.id.slice(0, 8).toUpperCase();

              return (
                <Link
                  key={request.id}
                  href={`/admin/production/${request.id}`}
                  className="group grid gap-4 rounded-md border border-[color:var(--line)] bg-white p-4 transition hover:border-[color:var(--foreground)] sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-[var(--foreground)]">
                        {requestNumber}
                      </p>
                      <StatusBadge tone={getStageTone(stage)}>
                        {cuttingStageLabels[stage]}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 line-clamp-2 font-medium text-[var(--foreground)]">
                      {request.material || request.subject}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-3.5" />
                        {request.contactName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FileStack className="size-3.5" />
                        Файлов: {request._count.files}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="size-3.5" />
                        {formatDate(
                          request.cuttingStageUpdatedAt ?? request.createdAt,
                        )}
                      </span>
                      {request.edgeOption ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Layers3 className="size-3.5" />
                          {request.edgeOption}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="flex size-10 items-center justify-center self-center border border-[color:var(--line-strong)] transition group-hover:bg-[var(--foreground)] group-hover:text-white">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-[color:var(--line-strong)] bg-white px-5 py-12 text-center">
            <p className="font-semibold text-[var(--foreground)]">
              Заявок для этой станции нет
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Можно отсканировать QR или изменить поисковый запрос.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
