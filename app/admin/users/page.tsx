import Link from "next/link";

import { LoyaltyTier } from "@/generated/prisma";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { requireAdminPermission } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  adjustUserLoyaltyPointsAction,
  approveLoyaltyTransactionAction,
  cancelLoyaltyTransactionAction,
  updateLoyaltyProgramSettingsAction,
  updateUserLoyaltyAction,
} from "@/app/admin/actions";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";
import { getAdminUsers } from "@/lib/server/users-admin";

export const dynamic = "force-dynamic";

const vipTiers = new Set<LoyaltyTier>([LoyaltyTier.GOLD, LoyaltyTier.PLATINUM]);

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
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

export default async function AdminUsersPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Программа лояльности заработает после подключения базы данных"
        description="Раздел уже готов для управления уровнями клиентов, личными скидками и накопленными баллами, но ему нужен рабочий PostgreSQL и production bootstrap."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Создайте клиентов вручную или через регистрацию после production bootstrap.",
        ]}
      />
    );
  }

  await requireAdminPermission("/admin/users", "/login?next=/admin/users");

  const [users, loyaltyConfig] = await Promise.all([
    getAdminUsers(),
    getLoyaltyProgramConfig(),
  ]);

  const vipUsers = users.filter((user) => vipTiers.has(user.loyaltyTier));

  const outstandingPoints = users.reduce(
    (sum, user) => sum + user.loyaltyPointsBalance,
    0,
  );

  const activeDiscounts = users.filter(
    (user) => getEffectiveDiscountPercent(user) > 0,
  );

  const rows = users.map((user) => {
    const tierBenefits = getLoyaltyTierBenefits(
      user.loyaltyTier,
      loyaltyConfig,
    );
    const effectiveDiscount = getEffectiveDiscountPercent(user, loyaltyConfig);
    const pendingPoints = user.loyaltyTransactions.reduce(
      (sum, transaction) => sum + transaction.points,
      0,
    );

    return {
      client: (
        <div className="space-y-1">
          <p className="font-semibold text-[var(--foreground)]">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {user.companyName ?? user.email}
          </p>
          {user.phone ? (
            <p className="text-xs text-[var(--muted)]">{user.phone}</p>
          ) : null}
        </div>
      ),
      profile: (
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getTierTone(user.loyaltyTier)}>
            {getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}
          </StatusBadge>
          <StatusBadge tone="neutral">{user.role.name}</StatusBadge>
        </div>
      ),
      loyalty: (
        <div className="space-y-1 text-sm text-[var(--foreground)]">
          <p>Скидка: {effectiveDiscount}%</p>
          <p className="text-xs text-[var(--muted)]">
            База уровня {tierBenefits.baseDiscountPercent}% + персонально{" "}
            {user.personalDiscountPercent}%
          </p>
          <p className="text-xs text-[var(--muted)]">
            Баланс: {formatNumber(user.loyaltyPointsBalance)} баллов
          </p>
          <p className="text-xs text-[var(--muted)]">
            Накоплено: {formatNumber(user.loyaltyPointsLifetime)} баллов
          </p>
          {pendingPoints > 0 ? (
            <p className="text-xs font-semibold text-[var(--accent)]">
              Ожидает подтверждения: {formatNumber(pendingPoints)}
            </p>
          ) : null}
        </div>
      ),
      activity: (
        <div className="space-y-1 text-sm text-[var(--foreground)]">
          <p>Заказы: {user._count.orders}</p>
          <p className="text-xs text-[var(--muted)]">
            Заявки: {user._count.requests}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Операции по баллам: {user._count.loyaltyTransactions}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Telegram:{" "}
            {user.telegramChatId
              ? user.telegramUsername
                ? `@${user.telegramUsername}`
                : "подключен"
              : "не подключен"}
          </p>
        </div>
      ),
      actions: (
        <div className="space-y-3">
          <form
            action={updateUserLoyaltyAction}
            className="grid gap-2 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3"
          >
            <input type="hidden" name="id" value={user.id} />
            <Select name="loyaltyTier" defaultValue={user.loyaltyTier}>
              {Object.values(LoyaltyTier).map((tier) => (
                <option key={tier} value={tier}>
                  {getLoyaltyTierLabel(tier, loyaltyConfig)}
                </option>
              ))}
            </Select>
            <Input
              name="personalDiscountPercent"
              type="number"
              min="0"
              max={loyaltyConfig.maxTotalDiscountPercent}
              defaultValue={user.personalDiscountPercent}
              placeholder="Персональная скидка"
            />
            <Button type="submit" variant="secondary" size="sm">
              Сохранить уровень
            </Button>
          </form>

          <form
            action={adjustUserLoyaltyPointsAction}
            className="grid gap-2 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3"
          >
            <input type="hidden" name="id" value={user.id} />
            <Input
              name="pointsDelta"
              type="number"
              placeholder="+250 или -100"
              required
            />
            <Input name="title" placeholder="Причина корректировки" />
            <Button type="submit" variant="accent" size="sm">
              Начислить или списать
            </Button>
          </form>

          <Link
            href={`/admin/users/${user.id}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[color:var(--line-strong)] px-3 text-center font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
          >
            QR и покупки
          </Link>

          {user.loyaltyTransactions.length > 0 ? (
            <div className="grid gap-2 rounded-2xl border border-[color:var(--line)] bg-[#fff8f3] p-3">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Ожидают подтверждения
              </p>
              {user.loyaltyTransactions.slice(0, 3).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-[var(--muted)]">
                    +{formatNumber(transaction.points)}
                  </span>
                  <div className="flex gap-1">
                    <form action={approveLoyaltyTransactionAction}>
                      <input
                        type="hidden"
                        name="transactionId"
                        value={transaction.id}
                      />
                      <Button type="submit" variant="accent" size="sm">
                        OK
                      </Button>
                    </form>
                    <form action={cancelLoyaltyTransactionAction}>
                      <input
                        type="hidden"
                        name="transactionId"
                        value={transaction.id}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        X
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Клиенты и программа лояльности"
          description="Здесь команда управляет уровнями Bronze, Silver, Gold и Platinum, персональными скидками и накопленными баллами каждого клиента."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Клиенты"
          value={users.length}
          detail="Все аккаунты клиентов и дилеров, доступные для персональных условий"
        />
        <MetricCard
          label="VIP-уровни"
          value={vipUsers.length}
          detail="Клиенты на уровнях Gold и Platinum"
        />
        <MetricCard
          label="Баллы в обороте"
          value={formatNumber(outstandingPoints)}
          detail={`${activeDiscounts.length} клиентов уже имеют активную скидку`}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        {[
          {
            title: "Онлайн-заказ",
            text: "После оформления создаются ожидающие баллы. Менеджер подтверждает их после оплаты или выдачи.",
          },
          {
            title: "Продажа в зале",
            text: "Менеджер сканирует QR клиента, собирает корзину на планшете и сохраняет покупку в историю.",
          },
          {
            title: "Списание",
            text: "Клиент может использовать только подтвержденный баланс. Лимит списания задается ниже.",
          },
          {
            title: "Ручная корректировка",
            text: "Админ может добавить или снять баллы с причиной, чтобы история оставалась понятной.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-[22px] border border-[color:var(--line)] bg-white/90 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.035)]"
          >
            <p className="font-semibold text-[var(--foreground)]">
              {item.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {item.text}
            </p>
          </article>
        ))}
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/86 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Правила бонусов
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Настройка процентов, уровней и лимитов
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Эти значения сразу влияют на checkout, личный кабинет и
              Telegram-ответы клиента. Баллы считаются как сомы: 1 балл = 1 сом
              скидки.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            Общий потолок скидки:{" "}
            <strong className="text-[var(--foreground)]">
              {loyaltyConfig.maxTotalDiscountPercent}%
            </strong>
          </div>
        </div>

        <form
          action={updateLoyaltyProgramSettingsAction}
          className="mt-5 grid gap-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Максимальная суммарная скидка, %
              <Input
                name="maxTotalDiscountPercent"
                type="number"
                min="0"
                max="50"
                defaultValue={loyaltyConfig.maxTotalDiscountPercent}
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Максимум списания баллами от заказа, %
              <Input
                name="maxRedeemPercent"
                type="number"
                min="0"
                max="100"
                defaultValue={loyaltyConfig.maxRedeemPercent}
              />
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            {loyaltyTierOrder.map((tier) => {
              const benefits = loyaltyConfig.tiers[tier];

              return (
                <fieldset
                  key={tier}
                  className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-4"
                >
                  <legend className="px-1 text-sm font-semibold text-[var(--foreground)]">
                    {getLoyaltyTierLabel(tier, loyaltyConfig)}
                  </legend>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                      Название уровня
                      <Input
                        name={`${tier}.label`}
                        defaultValue={benefits.label}
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                      Порог накопленных баллов
                      <Input
                        name={`${tier}.threshold`}
                        type="number"
                        min="0"
                        defaultValue={benefits.threshold}
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                      Скидка уровня, %
                      <Input
                        name={`${tier}.baseDiscountPercent`}
                        type="number"
                        min="0"
                        max="50"
                        defaultValue={benefits.baseDiscountPercent}
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                      Начисление бонусов, %
                      <Input
                        name={`${tier}.accrualPercent`}
                        type="number"
                        min="0"
                        max="50"
                        defaultValue={benefits.accrualPercent}
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
      </section>

      <DataTable
        columns={[
          { key: "client", label: "Клиент" },
          { key: "profile", label: "Уровень" },
          { key: "loyalty", label: "Скидка и баллы" },
          { key: "activity", label: "Активность" },
          { key: "actions", label: "Управление" },
        ]}
        rows={rows}
        caption="Клиенты и программа лояльности"
        emptyMessage="После появления клиентов в базе здесь можно будет настраивать уровни, личные скидки и баллы."
      />
    </div>
  );
}
