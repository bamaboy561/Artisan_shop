import { LoyaltyTier } from "@/generated/prisma";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  adjustUserLoyaltyPointsAction,
  createCustomerAction,
  deleteUserAction,
  updateUserLoyaltyAction,
} from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
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

type AdminUsersPageProps = {
  searchParams: Promise<{
    status?: string;
    email?: string;
    password?: string;
  }>;
};

function getStatusBanner(
  status: string | undefined,
  email: string | undefined,
  password: string | undefined,
) {
  switch (status) {
    case "customer-created":
      return {
        tone: "success" as const,
        text: password
          ? `Клиент ${email} создан. Временный пароль: ${password}. Передайте его клиенту — он сможет сменить в личном кабинете.`
          : `Клиент ${email} создан. Заданный вами пароль активен.`,
      };
    case "customer-exists":
      return {
        tone: "error" as const,
        text: `Пользователь ${email} уже существует. Найдите его в таблице ниже или используйте другой email.`,
      };
    case "customer-invalid":
      return {
        tone: "error" as const,
        text: "Заполните email и имя клиента — это обязательные поля.",
      };
    case "customer-database":
      return {
        tone: "error" as const,
        text: "База данных недоступна. Подключите PostgreSQL и попробуйте снова.",
      };
    case "customer-error":
      return {
        tone: "error" as const,
        text: `Не удалось создать клиента ${email ?? ""}. Проверьте данные и попробуйте ещё раз.`,
      };
    default:
      return null;
  }
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Программа лояльности заработает после подключения базы данных"
        description="Раздел уже готов для управления уровнями клиентов, личными скидками и накопленными баллами, но ему нужен рабочий PostgreSQL и seed-данные."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы получить стартовых клиентов с уровнями и баллами.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/users");

  const resolvedSearchParams = await searchParams;
  const banner = getStatusBanner(
    resolvedSearchParams.status,
    resolvedSearchParams.email,
    resolvedSearchParams.password,
  );

  const users = await getAdminUsers();

  const vipUsers = users.filter((user) => vipTiers.has(user.loyaltyTier));

  const outstandingPoints = users.reduce(
    (sum, user) => sum + user.loyaltyPointsBalance,
    0,
  );

  const activeDiscounts = users.filter(
    (user) => getEffectiveDiscountPercent(user) > 0,
  );

  const rows = users.map((user) => {
    const tierBenefits = getLoyaltyTierBenefits(user.loyaltyTier);
    const effectiveDiscount = getEffectiveDiscountPercent(user);

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const canDelete = user._count.orders === 0 && user._count.requests === 0;

    return {
      client: (
        <div className="space-y-1">
          <p className="font-semibold text-[var(--foreground)]">{fullName}</p>
          <p className="text-xs text-[var(--muted)]">{user.email}</p>
          {user.companyName ? (
            <p className="text-xs text-[var(--muted)]">{user.companyName}</p>
          ) : null}
          {user.phone ? (
            <p className="text-xs text-[var(--muted)]">{user.phone}</p>
          ) : null}
          <div className="mt-2">
            <StatusBadge
              tone={
                user.role.code === "CUSTOMER" || user.role.code === "DEALER"
                  ? "neutral"
                  : "accent"
              }
            >
              {user.role.name}
            </StatusBadge>
          </div>
        </div>
      ),
      profile: (
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getTierTone(user.loyaltyTier)}>
            {getLoyaltyTierLabel(user.loyaltyTier)}
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
                  {getLoyaltyTierLabel(tier)}
                </option>
              ))}
            </Select>
            <Input
              name="personalDiscountPercent"
              type="number"
              min="0"
              max="25"
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

          <form action={deleteUserAction}>
            <input type="hidden" name="id" value={user.id} />
            <ConfirmSubmit
              message={`Удалить пользователя ${fullName}? Это безвозвратно.`}
              className="h-8 w-full px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canDelete}
            >
              {canDelete
                ? "Удалить пользователя"
                : "Нельзя удалить — есть заказы или заявки"}
            </ConfirmSubmit>
          </form>
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

      {banner ? (
        <section
          className={`rounded-2xl border p-4 text-sm leading-6 ${
            banner.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {banner.text}
        </section>
      ) : null}

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
        <SectionHeading
          title="Создать клиента вручную"
          description="Когда клиент не может зарегистрироваться сам — заведите его здесь. Если пароль оставить пустым, мы сгенерируем временный и покажем его один раз после создания."
          titleClassName="text-xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
        <form action={createCustomerAction} className="mt-5 grid gap-3 lg:grid-cols-12">
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Имя *
            <Input name="firstName" placeholder="Алексей" required />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Фамилия
            <Input name="lastName" placeholder="Иванов" />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Email *
            <Input name="email" type="email" placeholder="client@example.com" required />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Телефон
            <Input name="phone" placeholder="+996 ..." />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-4">
            Компания
            <Input name="companyName" placeholder="Studio Form" />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-4">
            Пароль (оставьте пустым — сгенерируем)
            <Input name="password" type="text" placeholder="мин. 6 символов" />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
            Роль
            <Select name="roleCode" defaultValue="CUSTOMER">
              <option value="CUSTOMER">Клиент</option>
              <option value="DEALER">Дилер</option>
            </Select>
          </label>
          <div className="lg:col-span-2 lg:self-end">
            <Button type="submit" variant="accent" className="w-full">
              Создать
            </Button>
          </div>
        </form>
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
