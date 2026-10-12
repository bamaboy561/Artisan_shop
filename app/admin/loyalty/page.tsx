import Link from "next/link";
import { History, RefreshCw, Search } from "lucide-react";

import { LoyaltyTier, LoyaltyTransactionStatus } from "@/generated/prisma";
import {
  recalculateLoyaltyStatusesAction,
  updateLoyaltyProgramSettingsAction,
} from "@/app/admin/actions";
import { MetricCard } from "@/components/admin/metric-card";
import { RollbackLoyaltyTransactionButton } from "@/components/admin/rollback-loyalty-transaction-button";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageStaff, roleDefinitions } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyAuditLog } from "@/lib/server/loyalty-audit";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";

export const dynamic = "force-dynamic";

type AdminLoyaltyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatPercent(value: number) {
  return `${value}%`;
}

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : "";
}

function formatAuditDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bishkek",
  }).format(value);
}

const auditNoticeMessages: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  "rollback-complete": {
    tone: "success",
    text: "Операция откачена. Баланс клиента пересчитан, обратная запись добавлена в журнал.",
  },
  "rollback-insufficient-balance": {
    tone: "error",
    text: "Откат остановлен: на балансе клиента уже недостаточно баллов для полного возврата операции.",
  },
  "rollback-already-complete": {
    tone: "error",
    text: "Эта операция уже была откачена ранее.",
  },
  "rollback-is-reversal": {
    tone: "error",
    text: "Обратную запись нельзя откатить повторно. При необходимости создайте новую ручную корректировку.",
  },
  "rollback-not-approved": {
    tone: "error",
    text: "Откат доступен только для проведенной операции.",
  },
  "rollback-missing": {
    tone: "error",
    text: "Операция не найдена или не относится к ручным корректировкам.",
  },
  "rollback-invalid": {
    tone: "error",
    text: "Откат не подтвержден. Обновите страницу и повторите действие.",
  },
  "rollback-error": {
    tone: "error",
    text: "Не удалось выполнить откат. Баланс не изменен, повторите попытку.",
  },
};

function getTierTone(tier: LoyaltyTier) {
  if (tier === LoyaltyTier.PLATINUM) {
    return "success";
  }

  if (tier === LoyaltyTier.GOLD) {
    return "warning";
  }

  if (tier === LoyaltyTier.SILVER) {
    return "accent";
  }

  return "neutral";
}

async function getLoyaltyStats() {
  const db = getDb();

  const [
    clients,
    points,
    accruals,
    redemptions,
    ordersWithRedemption,
    linkedTelegramClients,
  ] = await Promise.all([
    db.user.count(),
    db.user.aggregate({
      _sum: {
        loyaltyPointsBalance: true,
        loyaltyPointsLifetime: true,
      },
    }),
    db.loyaltyTransaction.aggregate({
      where: {
        points: {
          gt: 0,
        },
      },
      _sum: {
        points: true,
      },
    }),
    db.loyaltyTransaction.aggregate({
      where: {
        points: {
          lt: 0,
        },
      },
      _sum: {
        points: true,
      },
    }),
    db.order.aggregate({
      where: {
        loyaltyRedemptionTotal: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        loyaltyRedemptionTotal: true,
      },
    }),
    db.user.count({
      where: {
        telegramChatId: {
          not: null,
        },
      },
    }),
  ]);

  return {
    clients,
    balance: points._sum.loyaltyPointsBalance ?? 0,
    lifetime: points._sum.loyaltyPointsLifetime ?? 0,
    accrued: accruals._sum.points ?? 0,
    redeemedPoints: Math.abs(redemptions._sum.points ?? 0),
    redeemedOrders: ordersWithRedemption._count._all,
    redeemedSom: ordersWithRedemption._sum.loyaltyRedemptionTotal ?? 0,
    linkedTelegramClients,
  };
}

export default async function AdminLoyaltyPage({
  searchParams,
}: AdminLoyaltyPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Бонусная система заработает после подключения базы данных"
        description="Раздел показывает уровни, баллы клиентов, списания и связь с Telegram/1C. Для работы нужен PostgreSQL и production bootstrap."
        steps={[
          "Добавьте DATABASE_URL в окружение.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "После появления клиентов здесь будет сводка по бонусной системе.",
        ]}
      />
    );
  }

  const session = await requireAdminSession(
    "/login?next=/admin/loyalty",
    "/admin/loyalty",
  );

  const params: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const reviewStatus = typeof params.review === "string" ? params.review : null;
  const changed =
    typeof params.changed === "string"
      ? Math.max(0, Number.parseInt(params.changed, 10) || 0)
      : 0;
  const reviewed =
    typeof params.reviewed === "string"
      ? Math.max(0, Number.parseInt(params.reviewed, 10) || 0)
      : 0;
  const settingsSaved = params.saved === "1";
  const auditQuery = getSearchValue(params, "q");
  const auditManagerId = getSearchValue(params, "manager");
  const auditDateFrom = getSearchValue(params, "dateFrom");
  const auditDateTo = getSearchValue(params, "dateTo");
  const auditPage = Math.max(
    1,
    Number.parseInt(getSearchValue(params, "page"), 10) || 1,
  );
  const auditNotice =
    auditNoticeMessages[getSearchValue(params, "auditNotice")] ?? null;

  const [stats, loyaltyConfig, audit] = await Promise.all([
    getLoyaltyStats(),
    getLoyaltyProgramConfig(),
    getLoyaltyAuditLog({
      query: auditQuery,
      managerId: auditManagerId,
      dateFrom: auditDateFrom,
      dateTo: auditDateTo,
      page: auditPage,
    }),
  ]);

  const tierRows = loyaltyTierOrder.map((tier) => {
    const benefits = getLoyaltyTierBenefits(tier, loyaltyConfig);

    return {
      tier: (
        <StatusBadge tone={getTierTone(tier)}>
          {getLoyaltyTierLabel(tier, loyaltyConfig)}
        </StatusBadge>
      ),
      plateThreshold:
        benefits.plateMaterialThreshold > 0
          ? `${formatNumber(benefits.plateMaterialThreshold)} сом закупок`
          : "с регистрации",
      fittingsThreshold:
        benefits.fittingsThreshold > 0
          ? `${formatNumber(benefits.fittingsThreshold)} сом закупок`
          : "с регистрации",
      plateAccrual: formatPercent(benefits.plateMaterialAccrualPercent),
      fittingsAccrual: formatPercent(benefits.fittingsAccrualPercent),
    };
  });

  const actionCards = [
    {
      title: "Клиенты",
      text: "Статусы по плитам и фурнитуре, баланс и ручные операции по баллам.",
      href: "/admin/users",
      action: "Открыть клиентов",
    },
    {
      title: "Продажа в зале",
      text: "Быстрая продажа с начислением бонусов после оплаты.",
      href: "/admin/sales-floor",
      action: "Открыть продажу",
    },
    {
      title: "Акции",
      text: "Промо-механики и Telegram-рассылка по клиентской базе.",
      href: "/admin/promotions",
      action: "Открыть акции",
    },
  ];
  const canRollbackOperations = canManageStaff(session.roleCode);
  const auditReturnParams = new URLSearchParams();

  if (audit.query) auditReturnParams.set("q", audit.query);
  if (audit.managerId) auditReturnParams.set("manager", audit.managerId);
  if (audit.dateFrom) auditReturnParams.set("dateFrom", audit.dateFrom);
  if (audit.dateTo) auditReturnParams.set("dateTo", audit.dateTo);
  if (audit.page > 1) auditReturnParams.set("page", String(audit.page));

  const getAuditPageHref = (page: number) => {
    const target = new URLSearchParams(auditReturnParams);

    if (page > 1) {
      target.set("page", String(page));
    } else {
      target.delete("page");
    }

    const query = target.toString();
    return query
      ? `/admin/loyalty?${query}#loyalty-audit`
      : "/admin/loyalty#loyalty-audit";
  };
  const auditRows = audit.operations.map((operation) => {
    const clientName =
      [operation.user.firstName, operation.user.lastName]
        .filter(Boolean)
        .join(" ") || operation.user.email;
    const balanceBefore =
      operation.balanceBefore ?? operation.balanceAfter - operation.points;
    const isReversal = Boolean(operation.reversalOfTransactionId);

    return {
      employee: operation.actor ? (
        <div className="min-w-40 space-y-1">
          <p className="font-semibold text-[var(--foreground)]">
            {operation.actor.displayName}
          </p>
          <p className="text-xs break-all text-[var(--muted)]">
            {operation.actor.email}
          </p>
        </div>
      ) : (
        <div className="min-w-36 space-y-1">
          <p className="font-semibold text-[var(--foreground)]">Система / 1С</p>
          <p className="text-xs text-[var(--muted)]">Без сотрудника</p>
        </div>
      ),
      client: (
        <div className="min-w-44 space-y-1">
          <p className="font-semibold text-[var(--foreground)]">{clientName}</p>
          <p className="text-xs break-all text-[var(--muted)]">
            {operation.user.email}
          </p>
          {operation.user.companyName ? (
            <p className="text-xs text-[var(--muted)]">
              {operation.user.companyName}
            </p>
          ) : null}
        </div>
      ),
      points: (
        <div className="min-w-28 space-y-2">
          <p
            className={`text-base font-bold ${
              operation.points > 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {operation.points > 0 ? "+" : ""}
            {formatNumber(operation.points)} баллов
          </p>
          <StatusBadge tone={isReversal ? "warning" : "accent"}>
            {isReversal
              ? "Откат"
              : operation.points > 0
                ? "Начисление"
                : "Списание"}
          </StatusBadge>
        </div>
      ),
      balance: (
        <div className="min-w-32 text-sm">
          <p>
            {formatNumber(balanceBefore)} →{" "}
            {formatNumber(operation.balanceAfter)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">до / после</p>
        </div>
      ),
      reason: (
        <div className="min-w-52 space-y-1">
          <p className="font-semibold text-[var(--foreground)]">
            {operation.title}
          </p>
          <p className="text-xs leading-5 text-[var(--muted)]">
            {operation.description || "Комментарий не указан"}
          </p>
        </div>
      ),
      date: (
        <p className="min-w-28 text-sm whitespace-nowrap">
          {formatAuditDate(operation.createdAt)}
        </p>
      ),
      action: operation.reversalTransactionId ? (
        <StatusBadge tone="neutral">Откат выполнен</StatusBadge>
      ) : isReversal ? (
        <StatusBadge tone="warning">Обратная запись</StatusBadge>
      ) : operation.status !== LoyaltyTransactionStatus.APPROVED ? (
        <StatusBadge tone="neutral">Не проведено</StatusBadge>
      ) : canRollbackOperations ? (
        <div className="min-w-28">
          <RollbackLoyaltyTransactionButton
            transactionId={operation.id}
            points={operation.points}
            clientName={clientName}
            returnQuery={auditReturnParams.toString()}
          />
        </div>
      ) : (
        <p className="min-w-32 text-xs leading-5 text-[var(--muted)]">
          Откат доступен администратору
        </p>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Бонусная система"
          description="Здесь собраны правила уровней, начисления и списания бонусов. Статусы пересчитываются каждый месяц по накопленному оплаченному обороту отдельно для плит и фурнитуры."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      {reviewStatus ? (
        <section
          className={`border px-4 py-3 text-sm ${
            reviewStatus === "complete"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {reviewStatus === "complete"
            ? `${settingsSaved ? "Правила сохранены. " : ""}Проверено клиентов: ${formatNumber(reviewed)}. Статус изменен у ${formatNumber(changed)}.`
            : "Не удалось пересчитать статусы. Повторите операцию или проверьте подключение к базе."}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Клиенты"
          value={formatNumber(stats.clients)}
          detail={`${formatNumber(stats.linkedTelegramClients)} клиентов уже привязали Telegram`}
        />
        <MetricCard
          label="Баллы на руках"
          value={formatNumber(stats.balance)}
          detail={`Всего накоплено ${formatNumber(stats.lifetime)} баллов`}
          tone="warning"
        />
        <MetricCard
          label="Начислено"
          value={formatNumber(stats.accrued)}
          detail="Сумма положительных бонусных операций"
          tone="success"
        />
        <MetricCard
          label="Списано"
          value={formatNumber(stats.redeemedSom)}
          detail={`${formatNumber(stats.redeemedOrders)} заказов, ${formatNumber(stats.redeemedPoints)} баллов`}
          tone="neutral"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[22px] border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)] sm:p-5">
          <SectionHeading
            title="Правила уровней"
            description="Только начисление бонусов: 1 балл равен 1 сому при списании, за один заказ можно оплатить бонусами не больше 50% суммы. Пороги считаются от накопленной суммы оплаченных закупок."
            titleClassName="text-xl"
            descriptionClassName="text-sm leading-6"
          />

          <div className="mt-4">
            <DataTable
              variant="embedded"
              columns={[
                { key: "tier", label: "Уровень" },
                { key: "plateThreshold", label: "Закупки плит" },
                { key: "fittingsThreshold", label: "Закупки фурнитуры" },
                { key: "plateAccrual", label: "% плит" },
                { key: "fittingsAccrual", label: "% фурнитуры" },
              ]}
              rows={tierRows}
              caption="Правила уровней бонусной системы"
            />
          </div>

          <form
            action={updateLoyaltyProgramSettingsAction}
            className="mt-5 grid gap-4"
          >
            <div className="rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Оплата бонусами до {loyaltyConfig.maxRedeemPercent}% заказа
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Это фиксированное правило программы: бонусы начисляются по
                категории товара, а списание ограничено половиной суммы покупки.
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {loyaltyTierOrder.map((tier) => {
                const benefits = loyaltyConfig.tiers[tier];

                return (
                  <fieldset
                    key={tier}
                    className="rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-4"
                  >
                    <legend className="px-1 text-sm font-semibold text-[var(--foreground)]">
                      {getLoyaltyTierLabel(tier, loyaltyConfig)}
                    </legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                        Название
                        <Input
                          name={`${tier}.label`}
                          defaultValue={benefits.label}
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                        Порог закупок плит, сом
                        <Input
                          name={`${tier}.plateMaterialThreshold`}
                          type="number"
                          min="0"
                          defaultValue={benefits.plateMaterialThreshold}
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                        Порог закупок фурнитуры, сом
                        <Input
                          name={`${tier}.fittingsThreshold`}
                          type="number"
                          min="0"
                          defaultValue={benefits.fittingsThreshold}
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                        Начисление по плитам, %
                        <Input
                          name={`${tier}.plateMaterialAccrualPercent`}
                          type="number"
                          min="0"
                          max="50"
                          defaultValue={benefits.plateMaterialAccrualPercent}
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                        Начисление по фурнитуре, %
                        <Input
                          name={`${tier}.fittingsAccrualPercent`}
                          type="number"
                          min="0"
                          max="50"
                          defaultValue={benefits.fittingsAccrualPercent}
                          className="h-10"
                        />
                      </label>
                    </div>
                  </fieldset>
                );
              })}
            </div>

            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Сохранить правила бонусов
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-3 border-t border-[color:var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              Ручной запуск применит действующие пороги к накопленному обороту
              клиентов до конца прошлого месяца.
            </p>
            <form action={recalculateLoyaltyStatusesAction}>
              <Button
                type="submit"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Пересчитать статусы
              </Button>
            </form>
          </div>
        </div>

        <div className="grid gap-4">
          {actionCards.map((card) => (
            <article
              key={card.href}
              className="rounded-[22px] border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)]"
            >
              <p className="text-base font-semibold text-[var(--foreground)]">
                {card.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {card.text}
              </p>
              <Link
                href={card.href}
                className={getButtonClassName(
                  card.href === "/admin/users" ? "accent" : "secondary",
                  "sm",
                  "mt-4",
                )}
              >
                {card.action}
              </Link>
            </article>
          ))}

          <article className="rounded-[22px] border border-[color:var(--line)] bg-[var(--surface)] p-4">
            <p className="text-base font-semibold text-[var(--foreground)]">
              Интеграция с 1C
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Профили, балансы и операции синхронизируются через API лояльности.
            </p>
            <code className="mt-3 block rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-xs text-[var(--foreground)]">
              /api/1c/loyalty
            </code>
          </article>
        </div>
      </section>

      <section
        id="loyalty-audit"
        className="scroll-mt-4 border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)] sm:p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            title="Журнал операций сотрудников"
            description="Все ручные начисления и списания сохраняются с сотрудником, клиентом, причиной и балансом до и после операции. Откат создает новую обратную запись и не удаляет исходные данные."
            titleClassName="text-xl"
            descriptionClassName="max-w-3xl text-sm leading-6"
          />
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <History className="size-4" aria-hidden="true" />
            {formatNumber(audit.total)} операций
          </div>
        </div>

        {auditNotice ? (
          <div
            className={`mt-4 border px-4 py-3 text-sm ${
              auditNotice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {auditNotice.text}
          </div>
        ) : null}

        <form
          action="/admin/loyalty"
          method="get"
          className="mt-4 grid gap-3 border-y border-[color:var(--line)] py-4 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_11rem_11rem_auto_auto]"
        >
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">
            Клиент
            <Input
              name="q"
              type="search"
              defaultValue={audit.query}
              placeholder="Имя, телефон, email или компания"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">
            Сотрудник
            <Select name="manager" defaultValue={audit.managerId}>
              <option value="">Все сотрудники</option>
              {audit.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.displayName} ·{" "}
                  {roleDefinitions[manager.role.code].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">
            Дата с
            <Input name="dateFrom" type="date" defaultValue={audit.dateFrom} />
          </label>
          <label className="grid gap-1.5 text-xs text-[var(--muted)]">
            Дата по
            <Input name="dateTo" type="date" defaultValue={audit.dateTo} />
          </label>
          <Button type="submit" variant="accent" className="self-end">
            <Search className="size-4" aria-hidden="true" />
            Найти
          </Button>
          <Link
            href="/admin/loyalty#loyalty-audit"
            className={getButtonClassName("secondary", "md", "self-end")}
          >
            Сбросить
          </Link>
        </form>

        <div className="mt-4">
          <DataTable
            variant="embedded"
            columns={[
              { key: "employee", label: "Сотрудник" },
              { key: "client", label: "Клиент" },
              { key: "points", label: "Операция" },
              { key: "balance", label: "Баланс" },
              { key: "reason", label: "Причина" },
              { key: "date", label: "Дата" },
              { key: "action", label: "Управление" },
            ]}
            rows={auditRows}
            emptyMessage="По выбранным фильтрам ручных операций не найдено."
            caption="Журнал ручных операций по бонусным баллам"
          />
        </div>

        {audit.totalPages > 1 ? (
          <Pagination
            currentPage={audit.page}
            totalPages={audit.totalPages}
            getHref={getAuditPageHref}
            className="mt-4"
          />
        ) : null}
      </section>
    </div>
  );
}
