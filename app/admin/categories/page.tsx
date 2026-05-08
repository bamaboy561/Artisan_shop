import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/ui/table";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { CategoryKind } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import { getAdminCategories } from "@/lib/server/catalog-admin";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryKindAction,
} from "@/app/admin/actions";

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
        description="После настройки PostgreSQL здесь можно будет управлять структурой каталога и сценариями заказа для каждой товарной группы."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените схему базы через prisma db push.",
          "Загрузите стартовые категории и бренды через prisma db seed.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/categories");

  const categories = await getAdminCategories();

  const rows = categories.map((category) => ({
    name: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {category.name}
        </p>
        <p className="text-xs text-[var(--muted)]">{category.slug}</p>
      </div>
    ),
    indicator: (
      <div className="space-y-1">
        <p>{category.indicator ?? "Без индикатора"}</p>
        <p className="text-xs text-[var(--muted)]">
          {category.scenario ?? "Сценарий не задан"}
        </p>
      </div>
    ),
    kind: (
      <form action={updateCategoryKindAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={category.id} />
        <Select
          name="kind"
          defaultValue={category.kind}
          className="h-9 min-w-[10rem] text-xs"
        >
          {Object.values(CategoryKind).map((kindValue) => (
            <option key={kindValue} value={kindValue}>
              {categoryKindLabels[kindValue]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="ghost" size="sm">
          Сохранить
        </Button>
      </form>
    ),
    summary: (
      <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
        {category.summary ?? "Краткое описание ещё не добавлено."}
      </p>
    ),
    stats: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="accent">
          {String(category._count.products)} товаров
        </StatusBadge>
        <StatusBadge tone="neutral">
          {String(category._count.promotions)} акций
        </StatusBadge>
      </div>
    ),
    actions: (
      <form action={deleteCategoryAction}>
        <input type="hidden" name="id" value={category.id} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={category._count.products > 0}
          className="text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
        >
          Удалить
        </Button>
      </form>
    ),
  }));

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Категории каталога"
          description="Управляйте структурой публичного каталога, индикаторами, сценариями заказа и порядком вывода."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
          <SectionHeading
            title="Новая категория"
            description="Минимальные поля для запуска новой группы каталога."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />

          <form action={createCategoryAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Название
                <Input name="name" placeholder="Стеновые панели" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="wall-panels" required />
              </label>
            </div>

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
                Индикатор
                <Input name="indicator" placeholder="Extravert" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Порядок
                <Input
                  name="sortOrder"
                  type="number"
                  min="0"
                  placeholder="90"
                />
              </label>
              <span />
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Сценарий заказа
              <Input
                name="scenario"
                placeholder="Запрос образцов и консультация"
              />
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Краткое описание
              <Textarea
                name="summary"
                rows={5}
                placeholder="Короткое описание направления для админки и витрины."
              />
            </label>

            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить категорию
            </Button>
          </form>
        </article>

        <DataTable
          columns={[
            { key: "name", label: "Категория" },
            { key: "kind", label: "Тип" },
            { key: "indicator", label: "Индикатор" },
            { key: "summary", label: "Описание" },
            { key: "stats", label: "Статистика" },
            { key: "actions", label: "Действия" },
          ]}
          rows={rows}
          caption="Категории"
          emptyMessage="После добавления категорий структура каталога появится здесь."
        />
      </section>
    </div>
  );
}
