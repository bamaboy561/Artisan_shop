import { Gem, Layers3, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { LoyaltyTier } from "@/generated/prisma";
import { StatusBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";

type LoyaltyOverviewProps = {
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    companyName: string | null;
    phone: string | null;
    loyaltyTier: LoyaltyTier;
    loyaltyPointsBalance: number;
    loyaltyPointsLifetime: number;
    personalDiscountPercent: number;
    roleName: string;
  };
  effectiveDiscount: number;
  summary: {
    ordersCount: number;
    activeOrdersCount: number;
    requestsCount: number;
    activeRequestsCount: number;
    favoritesCount: number;
  };
  progress: {
    currentThreshold: number;
    nextThreshold: number | null;
    pointsToNext: number;
    progressPercent: number;
    nextTier: LoyaltyTier | null;
  };
};

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

export function LoyaltyOverview({
  user,
  effectiveDiscount,
  summary,
  progress,
}: LoyaltyOverviewProps) {
  const currentBenefits = getLoyaltyTierBenefits(user.loyaltyTier);
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <section className="reveal-up space-y-4">
      <article className="surface-glow relative overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[var(--surface-strong)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,rgba(185,95,63,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,242,236,0.92))]" />
          <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(48,42,36,0.14),transparent_68%)]" />
          <div className="absolute inset-y-0 right-[8%] w-px bg-[linear-gradient(180deg,transparent,rgba(25,24,22,0.12),transparent)]" />
        </div>

        <div className="relative grid gap-6 p-6 sm:p-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={getTierTone(user.loyaltyTier)}>
                {getLoyaltyTierLabel(user.loyaltyTier)}
              </StatusBadge>
              <StatusBadge tone="accent">
                Персональная скидка {effectiveDiscount}%
              </StatusBadge>
            </div>

            <div className="max-w-3xl space-y-4">
              <p className="font-mono text-xs tracking-[0.26em] text-[var(--muted)] uppercase">
                Loyalty space
              </p>
              <h2 className="font-display max-w-3xl text-4xl leading-[0.95] text-balance text-[var(--foreground)] sm:text-5xl">
                {formatNumber(user.loyaltyPointsBalance)} баллов доступны для
                следующего заказа.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                Кабинет показывает ваш текущий статус клиента, накопленный объём
                заказов и прямую выгоду от сотрудничества с Artisan без лишней
                навигации по разделам.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-[28px] border border-black/8 bg-white/76 p-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">
                      До следующего уровня
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {progress.nextTier
                        ? getLoyaltyTierLabel(progress.nextTier)
                        : "Максимальный статус"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-right">
                    <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                      Осталось
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                      {progress.nextTier
                        ? `${formatNumber(progress.pointsToNext)} баллов`
                        : "0"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-3 rounded-full bg-black/6">
                  <div
                    className="h-3 rounded-full bg-[linear-gradient(90deg,var(--accent),#d6a07f)] transition-all duration-700"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <span>
                    Старт {formatNumber(progress.currentThreshold)} баллов
                  </span>
                  <span>
                    {progress.nextThreshold
                      ? `Цель ${formatNumber(progress.nextThreshold)}`
                      : "Платина закреплена"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="size-4 text-[var(--accent)]" />
                    <p className="text-sm text-[var(--muted)]">Кэшбэк уровня</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    {currentBenefits.accrualPercent}%
                  </p>
                </div>
                <div className="rounded-[24px] border border-black/8 bg-white/82 p-4">
                  <div className="flex items-center gap-3">
                    <Gem className="size-4 text-[var(--accent)]" />
                    <p className="text-sm text-[var(--muted)]">
                      Накоплено за всё время
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    {formatNumber(user.loyaltyPointsLifetime)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/checkout" variant="contrast" icon>
                Использовать баллы
              </ButtonLink>
              <ButtonLink href="/account/orders" variant="secondary">
                История заказов
              </ButtonLink>
              <ButtonLink href="/catalog" variant="ghost">
                Вернуться в каталог
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[30px] bg-[linear-gradient(180deg,var(--hero),#1e1b17)] p-6 text-white shadow-[var(--shadow-strong)]">
              <p className="font-mono text-xs tracking-[0.24em] text-white/56 uppercase">
                Профиль клиента
              </p>
              <h3 className="font-display mt-4 text-3xl leading-tight text-balance">
                {displayName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/70">
                {user.companyName ?? "Частный клиент"} · {user.roleName}
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                  <p className="text-xs tracking-[0.16em] text-white/50 uppercase">
                    Контакт
                  </p>
                  <p className="mt-2 text-sm text-white/88">{user.email}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {user.phone ?? "Телефон не указан"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                    <div className="flex items-center gap-2 text-white/50">
                      <Layers3 className="size-4" />
                      <span className="text-xs tracking-[0.16em] uppercase">
                        Заказы
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {summary.ordersCount}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      В работе: {summary.activeOrdersCount}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                    <div className="flex items-center gap-2 text-white/50">
                      <ShieldCheck className="size-4" />
                      <span className="text-xs tracking-[0.16em] uppercase">
                        Заявки
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {summary.requestsCount}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      Активные: {summary.activeRequestsCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[color:var(--line)] bg-white/82 p-5">
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <Sparkles className="size-4 text-[var(--accent)]" />
                  <p className="text-sm">Избранное</p>
                </div>
                <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  {summary.favoritesCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Сохранённые позиции для повторных заказов и быстрых расчётов.
                </p>
              </div>

              <div className="rounded-[24px] border border-[color:var(--line)] bg-white/82 p-5">
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <Wallet className="size-4 text-[var(--accent)]" />
                  <p className="text-sm">Личный бонус</p>
                </div>
                <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  +{user.personalDiscountPercent}%
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Дополнительная надбавка к скидке, закреплённая за вашим
                  аккаунтом.
                </p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-3 xl:grid-cols-4">
        {loyaltyTierOrder.map((tier, index) => {
          const benefits = getLoyaltyTierBenefits(tier);
          const isCurrent = tier === user.loyaltyTier;
          const isUnlocked = user.loyaltyPointsLifetime >= benefits.threshold;
          const isUpcoming = progress.nextTier === tier;

          return (
            <article
              key={tier}
              className={`reveal-up rounded-[26px] border p-5 transition-transform duration-300 hover:-translate-y-1 ${
                isCurrent
                  ? "border-[color:var(--accent)]/30 bg-[linear-gradient(180deg,rgba(185,95,63,0.12),rgba(255,255,255,0.92))] shadow-[var(--shadow-strong)]"
                  : "border-[color:var(--line)] bg-[var(--surface-strong)]"
              } ${index === 1 ? "delay-1" : ""} ${index > 1 ? "delay-2" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={getTierTone(tier)}>
                  {getLoyaltyTierLabel(tier)}
                </StatusBadge>
                <span className="text-[11px] tracking-[0.16em] text-[var(--muted)] uppercase">
                  {benefits.threshold === 0
                    ? "Старт"
                    : `${formatNumber(benefits.threshold)}+`}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">Скидка</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                    {benefits.baseDiscountPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    Начисление баллов
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                    {benefits.accrualPercent}%
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
                {isCurrent
                  ? "Текущий активный уровень клиента."
                  : isUpcoming
                    ? "Следующая цель в программе лояльности."
                    : isUnlocked
                      ? "Уровень уже пройден и закреплён в вашей истории."
                      : "Откроется после накопления нужного количества баллов."}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
