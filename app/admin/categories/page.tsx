import Link from "next/link";

import { deleteCategoryAction } from "@/app/admin/actions";
import { CategoryCreateForm } from "@/app/admin/categories/category-create-form";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryKind } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import { getAdminCategories } from "@/lib/server/catalog-admin";

const categoryKindLabels: Record<CategoryKind, string> = {
  [CategoryKind.PLATE]: "Плитный материал",
  [CategoryKind.FITTINGS]: "Фурнитура",
  [CategoryKind.OTHER]: "Другое",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Категории ждут подключения базы"
        description="После настройки PostgreSQL здесь можно будет управлять структурой каталога, сценариями заказа и порядком вывода товарных групп."
        steps={[
          "Добавьте DATABASE_URL в окружение.",
          "Примените схему базы через prisma db push.",
          "Создайте стартовые категории вручную или через импорт.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/categories");

  const categories = await getAdminCategories();

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-8">
        <SectionHeading
          title="Категории каталога"
          description="Менеджеру достаточно добавить название и тип. Технический адрес страницы, порядок и базовые подсказки система подготовит сама."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6 2xl:sticky 2xl:top-24">
          <SectionHeading
            title="Новая категория"
            description="Упрощенная форма для быстрого добавления разделов без технических лишних полей."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-6"
          />

          <CategoryCreateForm />
        </article>

        <article className="surface-glow min-w-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <div className="flex flex-col gap-4 border-b border-[color:var(--line)] p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="Список категорий"
              description="Карточки не ломают верстку длинными описаниями и сразу показывают, где уже есть товары."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="max-w-2xl text-sm leading-6"
            />

            <StatusBadge tone="neutral" className="shrink-0">
              {categories.length} категорий
            </StatusBadge>
          </div>

          {categories.length > 0 ? (
            <div className="grid gap-3 p-4 sm:p-5">
              {categories.map((category) => {
                const canDelete = category._count.products === 0;

                return (
                  <section
                    key={category.id}
                    className="grid min-w-0 gap-4 rounded-[22px] border border-[color:var(--line)] bg-white/78 p-4 transition hover:border-[#d8cec2] hover:bg-white sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/categories/${category.id}`}
                          className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] transition hover:text-[#9d573d]"
                        >
                          {category.name}
                        </Link>
                        <span className="rounded-full border border-[color:var(--line)] bg-[#f7f4ef] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                          /catalog/{category.slug}
                        </span>
                        <StatusBadge tone="neutral">
                          {categoryKindLabels[category.kind]}
                        </StatusBadge>
                        {category.isFeatured ? (
                          <StatusBadge tone="accent">В приоритете</StatusBadge>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
                        <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3">
                          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                            Индикатор
                          </p>
                          <p className="mt-1 text-[var(--foreground)]">
                            {category.indicator ?? "Не указан"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3">
                          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                            Сценарий заказа
                          </p>
                          <p className="mt-1 text-[var(--foreground)]">
                            {category.scenario ?? "Не задан"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 max-w-4xl text-sm leading-6 break-words text-[var(--muted)]">
                        {category.summary ??
                          "Краткое описание категории пока не добавлено."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:min-w-[168px] xl:flex-col xl:items-stretch">
                      <StatusBadge tone="accent" className="justify-center">
                        {String(category._count.products)} товаров
                      </StatusBadge>
                      <StatusBadge tone="neutral" className="justify-center">
                        {String(category._count.promotions)} акций
                      </StatusBadge>

                      <Link
                        href={`/admin/categories/${category.id}`}
                        className="inline-flex h-10 items-center justify-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
                      >
                        Редактировать
                      </Link>

                      <form action={deleteCategoryAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "Удалить категорию"
                              : "Нельзя удалить категорию, пока к ней привязаны товары"
                          }
                          className="h-10 w-full text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
                        >
                          Удалить
                        </Button>
                      </form>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              После добавления первой категории она появится в этом списке.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
