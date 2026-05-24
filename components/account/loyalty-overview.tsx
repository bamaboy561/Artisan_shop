import Link from "next/link";
import {
  ArrowUpRight,
  BadgePercent,
  FileStack,
  Gem,
  Heart,
  MessageCircle,
  ReceiptText,
  Scissors,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";

import { LoyaltyTier } from "@/generated/prisma";
import { StatusBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  loyaltyTierOrder,
} from "@/lib/server/pricing";
import { cn } from "@/lib/utils";

type LoyaltyOverviewProps = {
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    companyName: string | null;
    phone: string | null;
    telegramUsername: string | null;
    telegramLinked: boolean;
    telegramStartLink: string;
    telegramNotifyOrders: boolean;
    telegramNotifyRequests: boolean;
    telegramNotifyLoyalty: boolean;
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
  const nextTierLabel = progress.nextTier
    ? getLoyaltyTierLabel(progress.nextTier)
    : "Максимальный статус";

  const stats = [
    {
      label: "Заказы",
      value: summary.ordersCount,
      caption: `В работе ${summary.activeOrdersCount}`,
      href: "/account/orders",
      icon: ReceiptText,
    },
    {
      label: "Заявки",
      value: summary.requestsCount,
      caption: `Активные ${summary.activeRequestsCount}`,
      href: "/account/requests",
      icon: FileStack,
    },
    {
      label: "Избранное",
      value: summary.favoritesCount,
      caption: "Сохранённые позиции",
      href: "/account/favorites",
      icon: Heart,
    },
    {
      label: "Скидка",
      value: `${effectiveDiscount}%`,
      caption: "Персональная выгода",
      href: "/account",
      icon: BadgePercent,
    },
  ];

  const quickActions = [
    {
      href: "/catalog",
      label: "Каталог",
      description: "Материалы и фурнитура",
      icon: ShoppingBag,
    },
    {
      href: "/calculator",
      label: "Распил",
      description: "Расчёт деталей",
      icon: Scissors,
    },
    {
      href: user.telegramStartLink,
      label: user.telegramLinked ? "Telegram подключен" : "Подключить Telegram",
      description: user.telegramLinked
        ? user.telegramUsername
          ? `@${user.telegramUsername}`
          : "Статусы и бонусы в боте"
        : "Статусы заказов и распила",
      icon: MessageCircle,
      external: true,
    },
  ];

  return (
    <section className="reveal-up space-y-3 sm:space-y-4">
      <article className="relative overflow-hidden rounded-[26px] bg-[#111111] p-4 text-white shadow-[0_22px_58px_rgba(17,17,17,0.18)] sm:rounded-[32px] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(199,106,63,0.3),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]" />

        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={getTierTone(user.loyaltyTier)}
                className="border-white/10 bg-white text-[#111111]"
              >
                {getLoyaltyTierLabel(user.loyaltyTier)}
              </StatusBadge>
              <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-medium text-white/72">
                Скидка {effectiveDiscount}%
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-end">
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
                  {displayName}
                </p>
                <h2 className="mt-2 text-[2.05rem] font-semibold leading-[0.95] tracking-[-0.055em] text-white sm:text-5xl">
                  {formatNumber(user.loyaltyPointsBalance)}
                </h2>
                <p className="mt-2 text-sm text-white/58">
                  баллов доступно для следующих заказов
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-3">
                  <div className="flex items-center gap-2 text-white/52">
                    <Wallet className="size-4" />
                    <span className="text-[11px]">Кэшбэк</span>
                  </div>
                  <p className="mt-2 text-xl font-semibold">
                    {currentBenefits.accrualPercent}%
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-3">
                  <div className="flex items-center gap-2 text-white/52">
                    <Gem className="size-4" />
                    <span className="text-[11px]">Всего</span>
                  </div>
                  <p className="mt-2 text-xl font-semibold">
                    {formatNumber(user.loyaltyPointsLifetime)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.055] p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-white/48">Следующий уровень</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {nextTierLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/48">Осталось</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {progress.nextTier
                      ? formatNumber(progress.pointsToNext)
                      : "0"}
                  </p>
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,var(--accent),#e5b08f)] transition-all duration-700"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/42">
                <span>{formatNumber(progress.currentThreshold)}</span>
                <span>
                  {progress.nextThreshold
                    ? formatNumber(progress.nextThreshold)
                    : "Платина"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-[24px] border border-white/10 bg-white/[0.055] p-3 sm:p-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.2em] text-white/38 uppercase">
                Быстрые действия
              </p>
              <p className="mt-1 truncate text-sm text-white/62">
                {user.companyName ?? "Частный клиент"} · {user.roleName}
              </p>
            </div>

            <div className="grid gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    target={"external" in action && action.external ? "_blank" : undefined}
                    className="group flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.065] p-3 transition hover:border-white/25 hover:bg-white/[0.1]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111111]">
                        <Icon className="size-4" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {action.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/46">
                          {action.description}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-white/44 transition group-hover:text-white"
                      strokeWidth={1.8}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </article>

      <article className="grid gap-3 rounded-[24px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.04)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            Telegram
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {user.telegramLinked
              ? "Бот подключен к личному кабинету"
              : "Подключите бот для статусов"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {user.telegramLinked
              ? "Клиент получает обновления по заказам, заявкам на распил и бонусам прямо в Telegram."
              : "После подключения клиент увидит кнопки «Мои заказы», «Мои заявки», «Баллы и скидка» без ручных команд."}
          </p>
        </div>

        <Link
          href={user.telegramStartLink}
          target="_blank"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--foreground)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
        >
          {user.telegramLinked ? "Открыть бота" : "Подключить Telegram"}
        </Link>
      </article>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-[22px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.04)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--muted)]">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]">
                  <Icon className="size-4" strokeWidth={1.9} />
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                {item.caption}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {loyaltyTierOrder.map((tier) => {
          const benefits = getLoyaltyTierBenefits(tier);
          const isCurrent = tier === user.loyaltyTier;
          const isUnlocked = user.loyaltyPointsLifetime >= benefits.threshold;
          const isUpcoming = progress.nextTier === tier;

          return (
            <article
              key={tier}
              className={cn(
                "rounded-[22px] border p-4 transition-transform duration-300 hover:-translate-y-0.5",
                isCurrent
                  ? "border-[color:var(--accent)]/35 bg-[linear-gradient(180deg,rgba(185,95,63,0.12),rgba(255,255,255,0.94))] shadow-[0_18px_42px_rgba(17,17,17,0.06)]"
                  : "border-[color:var(--line)] bg-white/84",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={getTierTone(tier)}>
                  {getLoyaltyTierLabel(tier)}
                </StatusBadge>
                <span className="text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                  {benefits.threshold === 0
                    ? "Старт"
                    : `${formatNumber(benefits.threshold)}+`}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Скидка</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                    {benefits.baseDiscountPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Баллы</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                    {benefits.accrualPercent}%
                  </p>
                </div>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-[var(--muted)]">
                <Sparkles
                  className={cn(
                    "size-3.5 shrink-0",
                    isCurrent || isUnlocked
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted)]",
                  )}
                />
                {isCurrent
                  ? "Ваш текущий уровень"
                  : isUpcoming
                    ? "Следующая цель"
                    : isUnlocked
                      ? "Уровень уже пройден"
                      : "Откроется позже"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink href="/checkout" variant="contrast" icon>
          Использовать баллы
        </ButtonLink>
        <ButtonLink href="/catalog" variant="secondary">
          Перейти в каталог
        </ButtonLink>
      </div>
    </section>
  );
}
