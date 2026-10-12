import Link from "next/link";

import { LoyaltyTier } from "@/generated/prisma";
import { updateLoyaltyProgramSettingsAction } from "@/app/admin/actions";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";

export const dynamic = "force-dynamic";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatPercent(value: number) {
  return `${value}%`;
}

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

export default async function AdminLoyaltyPage() {
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

  await requireAdminSession("/login?next=/admin/loyalty", "/admin/loyalty");

  const [stats, loyaltyConfig] = await Promise.all([
    getLoyaltyStats(),
    getLoyaltyProgramConfig(),
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

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Бонусная система"
          description="Здесь собраны правила уровней, начисления и списания бонусов. Статусы пересчитываются каждый месяц отдельно по закупкам плит и фурнитуры."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

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
            description="Только начисление бонусов: 1 балл равен 1 сому при списании, за один заказ можно оплатить бонусами не больше 50% суммы. Пороги считаются от суммы оплаченных закупок за месяц."
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
    </div>
  );
}
