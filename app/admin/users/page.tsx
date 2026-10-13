import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";

import { LoyaltyTier } from "@/generated/prisma";
import { DownloadCsvButton } from "@/components/admin/download-csv-button";
import { Pagination } from "@/components/ui/pagination";
import { paginateItems, withPageParam } from "@/features/admin/paging";
import { NewClientForm } from "@/components/admin/new-client-form";
import { getClientEmailLabel } from "@/features/admin/client-identity";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DeleteClientButton } from "@/components/admin/delete-client-button";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  adjustUserLoyaltyPointsAction,
  approveLoyaltyTransactionAction,
  cancelLoyaltyTransactionAction,
  sendUserTelegramNoticeAction,
  updateLoyaltyProgramSettingsAction,
  updateUserLoyaltyAction,
} from "@/app/admin/actions";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import { createClientQrPayload } from "@/lib/server/client-qr";
import { canManageLoyalty } from "@/lib/server/loyalty-permissions";
import { getAdminUsers } from "@/lib/server/users-admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminUsersPageProps = {
  searchParams?: Promise<SearchParams>;
};

const vipTiers = new Set<LoyaltyTier>([LoyaltyTier.GOLD, LoyaltyTier.PLATINUM]);

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
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

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Программа лояльности заработает после подключения базы данных"
        description="Раздел уже готов для управления статусами клиентов, начислениями и накопленными баллами, но ему нужен рабочий PostgreSQL и production bootstrap."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Создайте клиентов вручную или через регистрацию после production bootstrap.",
        ]}
      />
    );
  }

  const session = await requireAdminSession(
    "/login?next=/admin/users",
    "/admin/users",
  );
  const mayManageLoyalty = await canManageLoyalty(session);

  const resolvedSearchParams = (await searchParams) ?? {};
  const userSearchQuery = getSearchValue(resolvedSearchParams, "q");
  const telegramNotice = getSearchValue(resolvedSearchParams, "telegramNotice");
  const telegramMessage = getSearchValue(
    resolvedSearchParams,
    "telegramMessage",
  );

  const [users, loyaltyConfig] = await Promise.all([
    getAdminUsers({ query: userSearchQuery }),
    getLoyaltyProgramConfig(),
  ]);

  const vipUsers = users.filter((user) => vipTiers.has(user.loyaltyTier));

  const outstandingPoints = users.reduce(
    (sum, user) => sum + user.loyaltyPointsBalance,
    0,
  );

  const csvCell = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const usersCsv = [
    [
      "Клиент",
      "Компания",
      "Телефон",
      "Email",
      "Уровень",
      "Баланс баллов",
      "Накоплено баллов",
      "Заказов",
      "Заявок",
      "Telegram",
    ],
    ...users.map((user) => [
      [user.firstName, user.lastName].filter(Boolean).join(" "),
      user.companyName ?? "",
      user.phone ?? "",
      user.email,
      getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig),
      user.loyaltyPointsBalance,
      user.loyaltyPointsLifetime,
      user._count.orders,
      user._count.requests,
      user.telegramChatId ? "привязан" : "",
    ]),
  ]
    .map((row) => row.map(csvCell).join(";"))
    .join("\n");

  const usersPage = paginateItems(users, resolvedSearchParams.page, 30);

  const rows = usersPage.items.map((user) => {
    const clientName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const clientQrUrl = `/api/qr?size=96&margin=2&data=${encodeURIComponent(
      createClientQrPayload(user.id),
    )}`;
    const plateMaterialTier = user.plateMaterialLoyaltyTier ?? user.loyaltyTier;
    const fittingsTier = user.fittingsLoyaltyTier ?? user.loyaltyTier;
    const plateMaterialBenefits = getLoyaltyTierBenefits(
      plateMaterialTier,
      loyaltyConfig,
    );
    const fittingsBenefits = getLoyaltyTierBenefits(
      fittingsTier,
      loyaltyConfig,
    );
    const pendingPoints = user.loyaltyTransactions.reduce(
      (sum, transaction) => sum + transaction.points,
      0,
    );

    return {
      client: (
        <div className="grid grid-cols-[54px_minmax(0,1fr)] items-start gap-3">
          <Image
            src={clientQrUrl}
            alt="QR клиента"
            width={54}
            height={54}
            unoptimized
            className="rounded-xl border border-[color:var(--line)] bg-white p-1"
          />
          <div className="min-w-0 space-y-1">
            <Link
              href={`/admin/users/${user.id}`}
              className="block font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
            >
              {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                user.email}
            </Link>
            <p className="text-xs text-[var(--muted)]">
              {user.companyName ?? getClientEmailLabel(user.email)}
            </p>
            {user.phone ? (
              <p className="text-xs text-[var(--muted)]">{user.phone}</p>
            ) : null}
          </div>
        </div>
      ),
      profile: (
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getTierTone(user.loyaltyTier)}>
            {getLoyaltyTierLabel(user.loyaltyTier, loyaltyConfig)}
          </StatusBadge>
          <StatusBadge tone={getTierTone(plateMaterialTier)}>
            Плиты: {getLoyaltyTierLabel(plateMaterialTier, loyaltyConfig)}
          </StatusBadge>
          <StatusBadge tone={getTierTone(fittingsTier)}>
            Фурнитура: {getLoyaltyTierLabel(fittingsTier, loyaltyConfig)}
          </StatusBadge>
          <StatusBadge tone="neutral">{user.role.name}</StatusBadge>
        </div>
      ),
      loyalty: (
        <div className="space-y-1 text-sm text-[var(--foreground)]">
          <p className="text-xs text-[var(--muted)]">
            Плиты: начисление{" "}
            {plateMaterialBenefits.plateMaterialAccrualPercent}%, порог{" "}
            {formatNumber(plateMaterialBenefits.plateMaterialThreshold)} сом
          </p>
          <p className="text-xs text-[var(--muted)]">
            Фурнитура: начисление {fittingsBenefits.fittingsAccrualPercent}%,
            порог {formatNumber(fittingsBenefits.fittingsThreshold)} сом
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
            <input type="hidden" name="loyaltyTier" value={user.loyaltyTier} />
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Статус плит
              <Select
                name="plateMaterialLoyaltyTier"
                defaultValue={plateMaterialTier}
              >
                {Object.values(LoyaltyTier).map((tier) => (
                  <option key={tier} value={tier}>
                    {getLoyaltyTierLabel(tier, loyaltyConfig)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Статус фурнитуры
              <Select name="fittingsLoyaltyTier" defaultValue={fittingsTier}>
                {Object.values(LoyaltyTier).map((tier) => (
                  <option key={tier} value={tier}>
                    {getLoyaltyTierLabel(tier, loyaltyConfig)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Личная скидка, %
              <Input
                name="personalDiscountPercent"
                type="number"
                min="0"
                max="50"
                inputMode="numeric"
                defaultValue={user.personalDiscountPercent ?? 0}
              />
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Сохранить уровень и скидку
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

          <div className="grid gap-2 rounded-2xl border border-[#68a994]/35 bg-[#f4fffb] p-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Личное Telegram-сообщение
              </p>
              <p className="text-xs leading-5 text-[var(--muted)]">
                {user.telegramChatId
                  ? "Сообщение уйдет только этому клиенту."
                  : "Клиент еще не подключил Telegram-бота."}
              </p>
            </div>
            {user.telegramChatId ? (
              <form
                action={sendUserTelegramNoticeAction}
                className="grid gap-2"
              >
                <input type="hidden" name="id" value={user.id} />
                <input
                  type="hidden"
                  name="returnQuery"
                  value={userSearchQuery}
                />
                <Input
                  name="telegramTitle"
                  defaultValue="Сообщение от Artisan"
                  maxLength={80}
                  className="h-10 bg-white"
                />
                <Textarea
                  name="telegramMessage"
                  rows={3}
                  maxLength={3000}
                  placeholder="Напишите уведомление для клиента"
                  required
                  className="min-h-24 rounded-xl bg-white"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Отправить в Telegram
                </Button>
              </form>
            ) : null}
          </div>

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

          <DeleteClientButton clientId={user.id} clientName={clientName} />
        </div>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Клиенты и программа лояльности"
          description="Здесь команда управляет уровнями Bronze, Silver, Gold и Platinum, балансами и ручными операциями по баллам каждого клиента."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <NewClientForm returnTo="users" />

      {!mayManageLoyalty ? (
        <section className="rounded-[18px] border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-800">
          Менять правила бонусов, уровни, баллы и личные скидки, а также удалять
          клиентов может администратор или менеджер, которому он выдал это право
          в разделе «Сотрудники». Ваши изменения в этих полях не сохранятся.
        </section>
      ) : null}

      {telegramNotice ? (
        <section className="overflow-hidden rounded-[24px] border border-[#68a994]/40 bg-[#f4fffb] p-5 shadow-[0_16px_48px_rgba(74,137,118,0.12)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[#2f7f68]">
                Telegram клиенту
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                Личное уведомление
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {telegramMessage || "Статус отправки обновлен."}
              </p>
            </div>
            <StatusBadge tone={telegramNotice === "ok" ? "success" : "warning"}>
              {telegramNotice === "ok" ? "Готово" : "Проверьте"}
            </StatusBadge>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3">
        <MetricCard
          label={userSearchQuery ? "Найдено" : "Клиенты"}
          value={users.length}
          detail={
            userSearchQuery
              ? `По запросу: ${userSearchQuery}`
              : "Все аккаунты клиентов и дилеров, доступные для бонусной программы"
          }
        />
        <MetricCard
          label="VIP-уровни"
          value={vipUsers.length}
          detail="Клиенты на уровнях Gold и Platinum"
        />
        <MetricCard
          label="Баллы в обороте"
          value={formatNumber(outstandingPoints)}
          detail="Доступный баланс клиентов для оплаты будущих заказов"
        />
      </section>

      <section className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/88 p-4 sm:p-5">
        <form
          action="/admin/users"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--accent)]">
              Поиск по клиентам
            </span>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]"
              />
              <Input
                name="q"
                type="search"
                defaultValue={userSearchQuery}
                placeholder="Имя, телефон, email, компания или Telegram"
                className="pl-10"
              />
            </div>
          </label>

          <Button
            type="submit"
            variant="accent"
            className="self-end whitespace-nowrap"
          >
            <Search aria-hidden="true" className="size-4" />
            Найти
          </Button>

          {userSearchQuery ? (
            <Link
              href="/admin/users"
              className={getButtonClassName(
                "secondary",
                "md",
                "self-end whitespace-nowrap",
              )}
            >
              <X aria-hidden="true" className="size-4" />
              Сбросить
            </Link>
          ) : null}
        </form>
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/86 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--accent)]">
              Правила бонусов
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Настройка процентов, уровней и лимитов
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Эти значения влияют на checkout, личный кабинет и Telegram-ответы
              клиента. 1 балл = 1 сом при списании, за заказ можно списать до
              50% суммы.
            </p>
          </div>
          <Link
            href="/admin/loyalty"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--line-strong)] px-4 text-xs font-semibold text-[var(--foreground)] transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
          >
            Сводка бонусов
          </Link>
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
              Порог статуса считается отдельно по закупкам плит и фурнитуры за
              всё время.
            </p>
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
                      Порог плит
                      <Input
                        name={`${tier}.plateMaterialThreshold`}
                        type="number"
                        min="0"
                        defaultValue={benefits.plateMaterialThreshold}
                        className="h-10"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                      Порог фурнитуры
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
      </section>

      <div className="flex justify-end">
        <DownloadCsvButton
          csvContent={usersCsv}
          fileName={`artisan-clients-${new Date().toISOString().slice(0, 10)}.csv`}
        />
      </div>

      <DataTable
        columns={[
          { key: "client", label: "Клиент" },
          { key: "profile", label: "Уровень" },
          { key: "loyalty", label: "Статусы и баллы" },
          { key: "activity", label: "Активность" },
          { key: "actions", label: "Управление" },
        ]}
        rows={rows}
        caption="Клиенты и программа лояльности"
        emptyMessage={
          userSearchQuery
            ? `По запросу «${userSearchQuery}» клиентов не найдено.`
            : "После появления клиентов в базе здесь можно будет настраивать уровни и баллы."
        }
      />
      {usersPage.totalPages > 1 ? (
        <Pagination
          currentPage={usersPage.currentPage}
          totalPages={usersPage.totalPages}
          getHref={(page) =>
            withPageParam(
              userSearchQuery
                ? `/admin/users?q=${encodeURIComponent(userSearchQuery)}`
                : "/admin/users",
              page,
            )
          }
        />
      ) : null}
    </div>
  );
}
