import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deletePromotionAction,
  sendPromotionTelegramBroadcastAction,
  updatePromotionAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DiscountType,
  PromotionStatus,
  PromotionTargetType,
} from "@/generated/prisma";
import {
  discountTypeLabels,
  promotionStatusLabels,
  promotionTargetLabels,
} from "@/features/admin/promotion-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getAdminPromotion,
  getPromotionFormOptions,
} from "@/lib/server/promotion-admin";

export const dynamic = "force-dynamic";

type EditPromotionPageProps = {
  params: Promise<{ id: string }>;
};

function toDateInputValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default async function EditPromotionPage({
  params,
}: EditPromotionPageProps) {
  if (!hasDatabaseUrl()) notFound();

  await requireAdminSession(
    "/login?next=/admin/promotions",
    "/admin/promotions",
  );

  const { id } = await params;
  const [promotion, options] = await Promise.all([
    getAdminPromotion(id),
    getPromotionFormOptions(),
  ]);

  if (!promotion) notFound();

  const selectedProductId = promotion.products[0]?.productId ?? "";
  const selectedCategoryId = promotion.categories[0]?.categoryId ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          title="Редактирование акции"
          description="Измените условия, сроки, промокод, товарную привязку и отображение акции на витрине."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
        <Link
          href="/admin/promotions"
          className={getButtonClassName("secondary", "sm")}
        >
          К акциям
        </Link>
      </div>

      <form
        action={updatePromotionAction}
        className="surface-glow grid gap-5 rounded-[28px] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6"
      >
        <input type="hidden" name="mode" value="full" />
        <input type="hidden" name="id" value={promotion.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Название
            <Input name="name" defaultValue={promotion.name} required />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Slug
            <Input name="slug" defaultValue={promotion.slug} required />
          </label>
        </div>

        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Описание
          <Textarea
            name="description"
            rows={4}
            defaultValue={promotion.description ?? ""}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Статус
            <Select name="status" defaultValue={promotion.status}>
              {Object.values(PromotionStatus).map((status) => (
                <option key={status} value={status}>
                  {promotionStatusLabels[status]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Цель акции
            <Select name="targetType" defaultValue={promotion.targetType}>
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
            <Select name="discountType" defaultValue={promotion.discountType}>
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
              defaultValue={promotion.discountValue}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Товар
            <Select name="productId" defaultValue={selectedProductId}>
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
            <Select name="categoryId" defaultValue={selectedCategoryId}>
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
            <Input name="promoCode" defaultValue={promotion.promoCode ?? ""} />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Бейдж
            <Input name="badgeText" defaultValue={promotion.badgeText ?? ""} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Минимальная сумма заказа
            <Input
              name="minOrderTotal"
              type="number"
              min="0"
              defaultValue={promotion.minOrderTotal ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Лимит использований
            <Input
              name="usageLimit"
              type="number"
              min="1"
              defaultValue={promotion.usageLimit ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Дата старта
            <Input
              name="startsAt"
              type="date"
              defaultValue={toDateInputValue(promotion.startsAt)}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Дата окончания
            <Input
              name="endsAt"
              type="date"
              defaultValue={toDateInputValue(promotion.endsAt)}
            />
          </label>
        </div>

        <Checkbox
          name="isHighlighted"
          value="on"
          defaultChecked={promotion.isHighlighted}
          label="Показывать как выделенную акцию"
          description="Используется для главной страницы, каталога и акцентных промо-блоков."
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <AdminSubmitButton
            type="submit"
            variant="accent"
            idleLabel="Сохранить изменения"
            pendingLabel="Сохраняем..."
          />
          <AdminSubmitButton
            type="submit"
            formAction={sendPromotionTelegramBroadcastAction}
            variant="secondary"
            disabled={promotion.status !== PromotionStatus.ACTIVE}
            idleLabel="Telegram промо"
            pendingLabel="Рассылаем..."
          />
          <ConfirmDeleteButton
            confirmMessage="Удалить акцию? Это действие нельзя отменить."
            formAction={deletePromotionAction}
            className="inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Удалить
          </ConfirmDeleteButton>
        </div>
      </form>
    </div>
  );
}
