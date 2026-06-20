import { SetupState } from "@/components/admin/setup-state";
import { AccountActivityPanel } from "@/components/account/account-activity-panel";
import { LoyaltyOverview } from "@/components/account/loyalty-overview";
import { SectionHeading } from "@/components/ui/section-heading";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountSummary, getAccountUser } from "@/lib/server/account-data";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getCurrentLoyaltyReviewPeriod,
  getUserLoyaltyPurchaseTotal,
} from "@/lib/server/loyalty-monthly-review";
import {
  getEffectiveDiscountPercent,
  getLoyaltyProgress,
} from "@/lib/server/pricing";
import { buildTelegramStartLink } from "@/lib/server/telegram-bot";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Личный кабинет станет рабочим после подключения базы данных"
        description="Раздел уже готов к отображению уровня клиента, персональной скидки, истории заказов и накопленных баллов, но ему нужен PostgreSQL и реальные клиенты."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Создайте клиентов в админке или через регистрацию после production bootstrap.",
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

  const currentLoyaltyPeriod = getCurrentLoyaltyReviewPeriod();
  const [summary, loyaltyConfig, currentMonthPurchaseTotal] =
    await Promise.all([
    getAccountSummary(user.id),
    getLoyaltyProgramConfig(),
    getUserLoyaltyPurchaseTotal(user.id, currentLoyaltyPeriod),
  ]);
  const effectiveDiscount = getEffectiveDiscountPercent(user, loyaltyConfig);
  const progress = getLoyaltyProgress(
    currentMonthPurchaseTotal,
    user.loyaltyTier,
    loyaltyConfig,
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <LoyaltyOverview
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          companyName: user.companyName,
          phone: user.phone,
          telegramUsername: user.telegramUsername,
          telegramLinked: Boolean(user.telegramLinkedAt),
          telegramStartLink: buildTelegramStartLink(user.id),
          telegramNotifyOrders: user.telegramNotifyOrders,
          telegramNotifyRequests: user.telegramNotifyRequests,
          telegramNotifyLoyalty: user.telegramNotifyLoyalty,
          telegramNotifyPromotions: user.telegramNotifyPromotions,
          loyaltyTier: user.loyaltyTier,
          loyaltyPointsBalance: user.loyaltyPointsBalance,
          loyaltyPointsLifetime: user.loyaltyPointsLifetime,
          currentMonthPurchaseTotal,
          personalDiscountPercent: user.personalDiscountPercent,
          roleName: user.role.name,
        }}
        effectiveDiscount={effectiveDiscount}
        loyaltyConfig={loyaltyConfig}
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
