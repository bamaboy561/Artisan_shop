import Link from "next/link";

import { createCategoryAction, deleteCategoryAction } from "@/app/admin/actions";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Категории каталога"
          description="Настройте разделы сайта: название, адрес страницы, тип материала, сценарий заказа и порядок показа в каталоге."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6 2xl:sticky 2xl:top-24">
          <SectionHeading
            title="Новая категория"
            description="Заполните основные поля. Остальные настройки можно будет уточнить на странице редактирования категории."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-6"
          />

          <form action={createCategoryAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Название
              <Input name="name" placeholder="Стеновые панели" required />
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Адрес страницы
              <Input name="slug" placeholder="wall-panels" required />
              <span className="text-xs leading-5 text-[var(--muted)]">
                Это часть ссылки после /catalog/. Например: wall-panels.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Тип
                <Select name="kind" defaultValue={CategoryKind.OTHER}>
                  {Object.values(CategoryKind).map((kindValue) => (
                    <option key={kindValue} value={kindValue}>
                      {categoryKindLabels[kindValue]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Порядок
                <Input name="sortOrder" type="number" min="0" placeholder="90" />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Индикатор
              <Input name="indicator" placeholder="МДФ панели" />
              <span className="text-xs leading-5 text-[var(--muted)]">
                Короткая подпись для карточек и витрины. Можно оставить пустым.
              </span>
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Сценарий заказа
              <Input name="scenario" placeholder="Запрос цены и консультация" />
              <span className="text-xs leading-5 text-[var(--muted)]">
                Подсказка менеджеру и клиенту: покупка, запрос цены или расчет.
              </span>
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Краткое описание
              <Textarea
                name="summary"
                rows={4}
                placeholder="Коротко опишите направление для админки и витрины."
              />
            </label>

            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить категорию
            </Button>
          </form>
        </article>

        <article className="surface-glow min-w-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <div className="flex flex-col gap-4 border-b border-[color:var(--line)] p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="Список категорий"
              description="Карточки не сжимают длинные описания и сразу показывают, какие разделы уже привязаны к товарам."
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
