import Form from "next/form";
import Link from "next/link";

import {
  DiscountType,
  PromotionStatus,
  PromotionTargetType,
} from "@/generated/prisma";
import {
  bulkUpdatePromotionsAction,
  createPromotionAction,
  deletePromotionAction,
  updatePromotionAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getAdminPromotions,
  getPromotionFormOptions,
} from "@/lib/server/promotion-admin";
import {
  adminPromotionSortOptions,
  buildAdminPromotionsHref,
  discountTypeLabels,
  filterAdminPromotions,
  parseAdminPromotionSearchParams,
  promotionStatusLabels,
  promotionTargetLabels,
  sortAdminPromotions,
  type AdminPromotionFilterState,
} from "@/features/admin/promotion-filters";

export const dynamic = "force-dynamic";

type AdminPromotionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const bulkActionOptions = [
  { value: "activate", label: "Активировать выбранные" },
  { value: "schedule", label: "Перевести в запланированные" },
  { value: "archive", label: "Архивировать" },
  { value: "highlight", label: "Выделить на витрине" },
  { value: "unhighlight", label: "Снять выделение" },
  { value: "clear-code", label: "Очистить промокод" },
  { value: "delete", label: "Удалить выбранные" },
] as const;

function formatDate(date: Date | null) {
  if (!date) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Без порога";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateRange(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) {
    return "Без срока";
  }

  if (startsAt && !endsAt) {
    return `С ${formatDate(startsAt)}`;
  }

  if (!startsAt && endsAt) {
    return `До ${formatDate(endsAt)}`;
  }

  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`;
}

function formatDiscount(discountType: DiscountType, discountValue: number) {
  switch (discountType) {
    case DiscountType.FIXED_AMOUNT:
      return `${new Intl.NumberFormat("ru-RU").format(discountValue)} сом`;
    case DiscountType.FIXED_PRICE:
      return `Цена ${new Intl.NumberFormat("ru-RU").format(discountValue)} сом`;
    case DiscountType.PERCENT:
    default:
      return `${discountValue}%`;
  }
}

function getStatusTone(status: PromotionStatus) {
  switch (status) {
    case PromotionStatus.ACTIVE:
      return "success" as const;
    case PromotionStatus.SCHEDULED:
      return "accent" as const;
    case PromotionStatus.EXPIRED:
      return "neutral" as const;
    case PromotionStatus.ARCHIVED:
      return "neutral" as const;
    case PromotionStatus.DRAFT:
    default:
      return "warning" as const;
  }
}

function getStateHref(
  state: AdminPromotionFilterState,
  overrides: Partial<AdminPromotionFilterState>,
) {
  return buildAdminPromotionsHref("/admin/promotions", {
    ...state,
    ...overrides,
  });
}

export default async function AdminPromotionsPage({
  searchParams,
}: AdminPromotionsPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Акции и скидки активируются после подключения базы"
        description="Раздел уже готов для управления промокодами, скидками по товарам, категориям и заказам. После подключения PostgreSQL здесь можно будет запускать реальные кампании и персональные предложения."
        steps={[
          "Добавьте рабочий DATABASE_URL в .env или выключите demo-режим, если база уже настроена.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы получить стартовые акции, товары и категории.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/promotions");

  const [promotions, options, resolvedSearchParams] = await Promise.all([
    getAdminPromotions(),
    getPromotionFormOptions(),
    searchParams,
  ]);

  const state = parseAdminPromotionSearchParams(resolvedSearchParams);
  const filteredPromotions = sortAdminPromotions(
    filterAdminPromotions(promotions, state),
    state.sort,
  );

  const activePromotions = promotions.filter(
    (promotion) => promotion.status === PromotionStatus.ACTIVE,
  );
  const highlightedPromotions = promotions.filter(
    (promotion) => promotion.isHighlighted,
  );
  const codePromotions = promotions.filter((promotion) => Boolean(promotion.promoCode));
  const orderPromotions = promotions.filter(
    (promotion) => promotion.targetType === PromotionTargetType.ORDER,
  );

  const activeFilters = [
    state.q
      ? {
          key: "q",
          label: `Поиск: ${state.q}`,
          href: getStateHref(state, { q: "" }),
        }
      : null,
    state.status !== "all"
      ? {
          key: "status",
          label: `Статус: ${promotionStatusLabels[state.status]}`,
          href: getStateHref(state, { status: "all" }),
        }
      : null,
    state.targetType !== "all"
      ? {
          key: "targetType",
          label: `Цель: ${promotionTargetLabels[state.targetType]}`,
          href: getStateHref(state, { targetType: "all" }),
        }
      : null,
    state.highlighted !== "all"
      ? {
          key: "highlighted",
          label:
            state.highlighted === "highlighted"
              ? "Только выделенные"
              : "Без выделения",
          href: getStateHref(state, { highlighted: "all" }),
        }
      : null,
    state.promoCode !== "all"
      ? {
          key: "promoCode",
          label:
            state.promoCode === "with-code"
              ? "С промокодом"
              : "Без промокода",
          href: getStateHref(state, { promoCode: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  const rows = filteredPromotions.map((promotion) => {
    const primaryTarget =
      promotion.products[0]?.product.name ??
      promotion.categories[0]?.category.name ??
      "Весь заказ";

    return {
      select: (
        <input
          type="checkbox"
          name="promotionIds"
          value={promotion.id}
          form="bulk-promotions-form"
          data-promotion-bulk-checkbox="true"
          className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
          aria-label={`Выбрать акцию ${promotion.name}`}
        />
      ),
      promotion: (
        <div className="space-y-1">
          <p className="font-semibold text-[var(--foreground)]">
            {promotion.name}
          </p>
          <p className="text-xs text-[var(--muted)]">{promotion.slug}</p>
          {promotion.description ? (
            <p className="text-xs leading-5 text-[var(--muted)]">
              {promotion.description}
            </p>
          ) : null}
        </div>
      ),
      target: (
        <div className="space-y-2">
          <StatusBadge tone="neutral">
            {promotionTargetLabels[promotion.targetType]}
          </StatusBadge>
          <p className="text-sm text-[var(--foreground)]">{primaryTarget}</p>
          <p className="text-xs text-[var(--muted)]">
            {promotion._count.products > 0
              ? `${promotion._count.products} товаров`
              : promotion._count.categories > 0
                ? `${promotion._count.categories} категорий`
                : "Заказ без привязки"}
          </p>
        </div>
      ),
      offer: (
        <div className="space-y-2">
          <p className="font-medium text-[var(--foreground)]">
            {formatDiscount(promotion.discountType, promotion.discountValue)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {discountTypeLabels[promotion.discountType]}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {promotion.promoCode
              ? `Промокод: ${promotion.promoCode}`
              : "Без промокода"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Порог: {formatCurrency(promotion.minOrderTotal)}
          </p>
        </div>
      ),
      timing: (
        <div className="space-y-2">
          <p className="text-sm text-[var(--foreground)]">
            {formatDateRange(promotion.startsAt, promotion.endsAt)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Использовано {promotion.usageCount}
            {promotion.usageLimit ? ` из ${promotion.usageLimit}` : ""}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Обновлено {formatDate(promotion.updatedAt)}
          </p>
        </div>
      ),
      status: (
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(promotion.status)}>
            {promotionStatusLabels[promotion.status]}
          </StatusBadge>
          {promotion.isHighlighted ? (
            <StatusBadge tone="warning">Выделена</StatusBadge>
          ) : null}
          {promotion.badgeText ? (
            <StatusBadge tone="accent">{promotion.badgeText}</StatusBadge>
          ) : null}
        </div>
      ),
      manage: (
        <form action={updatePromotionAction} className="grid gap-2">
          <input type="hidden" name="id" value={promotion.id} />
          <Select name="status" defaultValue={promotion.status} className="h-9 text-xs">
            {Object.values(PromotionStatus).map((status) => (
              <option key={status} value={status}>
                {promotionStatusLabels[status]}
              </option>
            ))}
          </Select>
          <Input
            name="promoCode"
            defaultValue={promotion.promoCode ?? ""}
            placeholder="Промокод"
          />
          <Input
            name="badgeText"
            defaultValue={promotion.badgeText ?? ""}
            placeholder="Бейдж на витрине"
          />
          <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]">
            <input
              name="isHighlighted"
              type="checkbox"
              value="on"
              defaultChecked={promotion.isHighlighted}
              className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
            />
            Показывать на витрине
          </label>
          <div className="flex flex-wrap gap-2">
            <AdminSubmitButton
              type="submit"
              variant="secondary"
              size="sm"
              idleLabel="Сохранить"
              pendingLabel="Сохраняем..."
            />
            <button
              type="submit"
              formAction={deletePromotionAction}
              className="inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Удалить
            </button>
          </div>
        </form>
      ),
    };
  });

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Акции и скидки"
          description="Рабочий контур для промокодов, выделенных кампаний и коммерческих сценариев по товарам, категориям и заказам. Здесь команда может быстро запускать промо-механику без перехода в отдельные экраны."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего акций"
          value={promotions.length}
          detail={`${filteredPromotions.length} видно по текущему срезу`}
        />
        <MetricCard
          label="Активные"
          value={activePromotions.length}
          detail="Кампании, которые уже влияют на витрину и цену"
        />
        <MetricCard
          label="Выделенные"
          value={highlightedPromotions.length}
          detail="Акции, которые можно показывать на главной и в каталоге"
        />
        <MetricCard
          label="Промокоды"
          value={codePromotions.length}
          detail={`${orderPromotions.length} механик работают на уровне заказа`}
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Фильтры кампаний
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Быстрый срез по промо-механикам
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Можно быстро выделить только активные промо, только акции с промокодом
              или только витринные предложения, чтобы команда не терялась в списке.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={getStateHref(state, { status: PromotionStatus.ACTIVE })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Активные
            </Link>
            <Link
              href={getStateHref(state, {
                highlighted: "highlighted",
              })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Выделенные
            </Link>
            <Link
              href={getStateHref(state, { promoCode: "with-code" })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              С промокодом
            </Link>
            <Link
              href={getStateHref(state, { targetType: PromotionTargetType.ORDER })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              По заказу
            </Link>
          </div>
        </div>

        <Form action="/admin/promotions" scroll={false} className="mt-6 grid gap-4 xl:grid-cols-6">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-[var(--foreground)]">
              Поиск по названию, slug, промокоду и целям
            </span>
            <Input
              name="q"
              defaultValue={state.q}
              placeholder="Например, kitchen-start или ARTISAN1000"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Статус</span>
            <Select name="status" defaultValue={state.status}>
              <option value="all">Все статусы</option>
              {Object.values(PromotionStatus).map((status) => (
                <option key={status} value={status}>
                  {promotionStatusLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Цель</span>
            <Select name="targetType" defaultValue={state.targetType}>
              <option value="all">Все цели</option>
              {Object.values(PromotionTargetType).map((targetType) => (
                <option key={targetType} value={targetType}>
                  {promotionTargetLabels[targetType]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Выделение</span>
            <Select name="highlighted" defaultValue={state.highlighted}>
              <option value="all">Все кампании</option>
              <option value="highlighted">Только выделенные</option>
              <option value="regular">Без выделения</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Промокод</span>
            <Select name="promoCode" defaultValue={state.promoCode}>
              <option value="all">Все кампании</option>
              <option value="with-code">Только с промокодом</option>
              <option value="without-code">Без промокода</option>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Сортировка</span>
            <Select name="sort" defaultValue={state.sort}>
              {adminPromotionSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex flex-wrap items-end gap-3 xl:col-span-6">
            <AdminSubmitButton
              type="submit"
              variant="accent"
              idleLabel="Применить"
              pendingLabel="Применяем..."
            />
            <Link
              href="/admin/promotions"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить всё
            </Link>
            <span className="text-sm text-[var(--muted)]">
              Найдено {filteredPromotions.length} из {promotions.length} кампаний
            </span>
          </div>
        </Form>

        {activeFilters.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] transition hover:border-[color:var(--line-strong)]"
              >
                {filter.label} ×
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
          <SectionHeading
            title="Новая акция"
            description="Создайте промокод, скидку по товару или категорийную кампанию и сразу отправьте её в рабочий контур."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />

          <form action={createPromotionAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Название
                <Input name="name" placeholder="Старт кухни" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="kitchen-start" required />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Описание
              <Textarea
                name="description"
                rows={4}
                placeholder="Короткое описание кампании для команды и витрины."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Статус
                <Select name="status" defaultValue={PromotionStatus.ACTIVE}>
                  {Object.values(PromotionStatus).map((status) => (
                    <option key={status} value={status}>
                      {promotionStatusLabels[status]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Цель акции
                <Select
                  name="targetType"
                  defaultValue={PromotionTargetType.PRODUCT}
                >
                  {Object.values(PromotionTargetType).map((targetType) => (
                    <option key={targetType} value={targetType}>
                      {promotionTargetLabels[targetType]}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Тип скидки
                <Select name="discountType" defaultValue={DiscountType.PERCENT}>
                  {Object.values(DiscountType).map((discountType) => (
                    <option key={discountType} value={discountType}>
                      {discountTypeLabels[discountType]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Значение скидки
                <Input
                  name="discountValue"
                  type="number"
                  min="1"
                  placeholder="10"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Товар
                <Select name="productId" defaultValue="">
                  <option value="">Без привязки к товару</option>
                  {options.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Категория
                <Select name="categoryId" defaultValue="">
                  <option value="">Без привязки к категории</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Промокод
                <Input name="promoCode" placeholder="ARTISAN1000" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Бейдж
                <Input name="badgeText" placeholder="-10% до конца месяца" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Минимальная сумма заказа
                <Input
                  name="minOrderTotal"
                  type="number"
                  min="0"
                  placeholder="15000"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Лимит использований
                <Input
                  name="usageLimit"
                  type="number"
                  min="1"
                  placeholder="50"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Дата старта
                <Input name="startsAt" type="date" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Дата окончания
                <Input name="endsAt" type="date" />
              </label>
            </div>

            <Checkbox
              name="isHighlighted"
              value="on"
              label="Показывать как выделенную акцию"
              description="Используется для главной страницы, каталога и акцентных промо-блоков."
              className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
            />

            <AdminSubmitButton
              type="submit"
              variant="accent"
              className="w-full sm:w-auto"
              idleLabel="Создать акцию"
              pendingLabel="Создаем..."
            />
          </form>
        </article>

        <article className="space-y-4">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Массовые действия
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                  Работа с текущей выборкой
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Выделите нужные кампании в таблице и быстро переведите их в активные,
                  архивные, очистите промокоды или снимите выделение на витрине.
                </p>
              </div>

              <BulkSelectionTools checkboxSelector="[data-promotion-bulk-checkbox='true']" />
            </div>

            <form
              id="bulk-promotions-form"
              action={bulkUpdatePromotionsAction}
              className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Select name="bulkAction" defaultValue="">
                <option value="" disabled>
                  Выберите действие для отмеченных кампаний
                </option>
                {bulkActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                idleLabel="Применить"
                pendingLabel="Применяем..."
              />
            </form>
          </section>

          <DataTable
            columns={[
              { key: "select", label: "" },
              { key: "promotion", label: "Акция" },
              { key: "target", label: "Цель" },
              { key: "offer", label: "Предложение" },
              { key: "timing", label: "Период и лимит" },
              { key: "status", label: "Статус" },
              { key: "manage", label: "Быстрое управление" },
            ]}
            rows={rows}
            caption="Список акций и скидок"
            emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
          />
        </article>
      </section>
    </div>
  );
}
