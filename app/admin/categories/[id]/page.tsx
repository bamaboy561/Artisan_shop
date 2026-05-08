import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteCategoryAction, updateCategoryAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryKind } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

const categoryKindLabels: Record<CategoryKind, string> = {
  [CategoryKind.PLATE]: "Плитный материал",
  [CategoryKind.FITTINGS]: "Фурнитура",
  [CategoryKind.OTHER]: "Другое",
};

export default async function EditCategoryPage({
  params,
}: EditCategoryPageProps) {
  if (!hasDatabaseUrl()) notFound();

  await requireAdminSession("/login?next=/admin/categories");

  const { id } = await params;
  const category = await getDb().category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          products: true,
          promotions: true,
        },
      },
    },
  });

  if (!category) notFound();

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/categories"
              className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase transition hover:text-[#9d573d]"
            >
              ← К списку категорий
            </Link>
            <SectionHeading
              title={category.name}
              description={`Редактирование категории. Товаров: ${category._count.products}, акций: ${category._count.promotions}.`}
              titleClassName="mt-2 text-2xl sm:text-3xl"
              descriptionClassName="text-sm leading-7"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/catalog/${category.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)]"
            >
              Открыть на сайте
            </Link>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={category._count.products > 0}
                className="h-10 px-4 text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
              >
                Удалить категорию
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <form action={updateCategoryAction} className="grid gap-6">
          <input type="hidden" name="id" value={category.id} />

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Название
              <Input name="name" defaultValue={category.name} required />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Slug
              <Input
                name="slug"
                defaultValue={category.slug}
                required
                aria-describedby="category-slug-help"
              />
              <span
                id="category-slug-help"
                className="text-xs leading-5 text-[var(--muted)]"
              >
                Часть адреса страницы: /catalog/{category.slug}
              </span>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Тип
              <Select name="kind" defaultValue={category.kind}>
                {Object.values(CategoryKind).map((kindValue) => (
                  <option key={kindValue} value={kindValue}>
                    {categoryKindLabels[kindValue]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Порядок
              <Input
                name="sortOrder"
                type="number"
                min="0"
                defaultValue={category.sortOrder}
              />
            </label>
            <Checkbox
              name="isFeatured"
              defaultChecked={category.isFeatured}
              label="Показывать выше"
              description="Категория будет иметь приоритет в публичных подборках."
              className="self-end rounded-xl border-[color:var(--line)] bg-white/55 p-3"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Индикатор
              <Input
                name="indicator"
                defaultValue={category.indicator ?? ""}
                placeholder="AGT, Extravert, Hettich"
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Сценарий заказа
              <Input
                name="scenario"
                defaultValue={category.scenario ?? ""}
                placeholder="Покупка онлайн / запрос цены / расчет распила"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Краткое описание
            <Textarea
              name="summary"
              rows={4}
              defaultValue={category.summary ?? ""}
              placeholder="Короткое описание категории для карточек и админки."
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Полное описание
            <Textarea
              name="description"
              rows={7}
              defaultValue={category.description ?? ""}
              placeholder="Подробное описание раздела для страницы категории."
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Обложка
              <Input
                name="coverImage"
                defaultValue={category.coverImage ?? ""}
                placeholder="https://... или /images/category.jpg"
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Акцентный текст
              <Input
                name="spotlight"
                defaultValue={category.spotlight ?? ""}
                placeholder="Короткий текст для hero-блока"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              SEO title
              <Input
                name="seoTitle"
                defaultValue={category.seoTitle ?? ""}
                placeholder="Заголовок для поисковиков"
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              SEO description
              <Input
                name="seoDescription"
                defaultValue={category.seoDescription ?? ""}
                placeholder="Описание для поисковой выдачи"
              />
            </label>
          </div>

          <AdminSubmitButton
            type="submit"
            variant="accent"
            className="w-full sm:w-auto"
            idleLabel="Сохранить изменения"
            pendingLabel="Сохраняем..."
          />
        </form>
      </section>
    </div>
  );
}
