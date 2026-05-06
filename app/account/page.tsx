import { SetupState } from "@/components/admin/setup-state";
import { AccountActivityPanel } from "@/components/account/account-activity-panel";
import { LoyaltyOverview } from "@/components/account/loyalty-overview";
import { SectionHeading } from "@/components/ui/section-heading";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountSummary, getAccountUser } from "@/lib/server/account-data";
import {
  getEffectiveDiscountPercent,
  getLoyaltyProgress,
} from "@/lib/server/pricing";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Личный кабинет станет рабочим после подключения базы данных"
        description="Раздел уже готов к отображению уровня клиента, персональной скидки, истории заказов и накопленных баллов, но ему нужен PostgreSQL и стартовые данные."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы загрузить клиентов, уровни и баллы.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return (
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Кабинет появится после создания первого клиента"
          description="Как только в базе появится клиентский аккаунт, здесь откроются персональные скидки, история заказов и программа лояльности."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>
    );
  }

  const summary = await getAccountSummary(user.id);
  const effectiveDiscount = getEffectiveDiscountPercent(user);
  const progress = getLoyaltyProgress(
    user.loyaltyPointsLifetime,
    user.loyaltyTier,
  );

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Личный кабинет"
          description="Профиль клиента, программа лояльности, активные заказы и накопительная история в одной рабочей среде."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>

      <LoyaltyOverview
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          companyName: user.companyName,
          phone: user.phone,
          loyaltyTier: user.loyaltyTier,
          loyaltyPointsBalance: user.loyaltyPointsBalance,
          loyaltyPointsLifetime: user.loyaltyPointsLifetime,
          personalDiscountPercent: user.personalDiscountPercent,
          roleName: user.role.name,
        }}
        effectiveDiscount={effectiveDiscount}
        summary={{
          ordersCount: summary.ordersCount,
          activeOrdersCount: summary.activeOrdersCount,
          requestsCount: summary.requestsCount,
          activeRequestsCount: summary.activeRequestsCount,
          favoritesCount: summary.favoritesCount,
        }}
        progress={progress}
      />

      <AccountActivityPanel
        transactions={summary.recentTransactions}
        recentOrders={summary.recentOrders}
        recentRequests={summary.recentRequests}
      />
    </div>
  );
}
