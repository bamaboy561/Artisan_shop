import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/admin/actions";
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

const categoryKindHints: Record<CategoryKind, string> = {
  [CategoryKind.PLATE]: "ЛДСП, МДФ, панели и другие плитные материалы.",
  [CategoryKind.FITTINGS]: "Петли, направляющие, механизмы и комплектующие.",
  [CategoryKind.OTHER]: "Разделы, которые не относятся к плитам или фурнитуре.",
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
                title={
                  category._count.products > 0
                    ? "Нельзя удалить категорию, пока к ней привязаны товары"
                    : "Удалить категорию"
                }
                className="h-10 px-4 text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
              >
                Удалить категорию
              </Button>
            </form>
          </div>
        </div>
      </section>

      <form action={updateCategoryAction} className="grid gap-4">
        <input type="hidden" name="id" value={category.id} />

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
            <SectionHeading
              title="Основные настройки"
              description="Эти поля влияют на адрес, название и поведение категории в каталоге."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="text-sm leading-6"
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Название
                <Input name="name" defaultValue={category.name} required />
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Адрес страницы
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
                  Это не заголовок, а часть ссылки: /catalog/{category.slug}.
                  Менять стоит аккуратно, если ссылка уже используется.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_160px]">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Тип категории
                <Select name="kind" defaultValue={category.kind}>
                  {Object.values(CategoryKind).map((kindValue) => (
                    <option key={kindValue} value={kindValue}>
                      {categoryKindLabels[kindValue]}
                    </option>
                  ))}
                </Select>
                <span className="text-xs leading-5 text-[var(--muted)]">
                  {categoryKindHints[category.kind]}
                </span>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Порядок
                <Input
                  name="sortOrder"
                  type="number"
                  min="0"
                  defaultValue={category.sortOrder}
                />
                <span className="text-xs leading-5 text-[var(--muted)]">
                  Чем меньше число, тем выше раздел.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Индикатор
                <Input
                  name="indicator"
                  defaultValue={category.indicator ?? ""}
                  placeholder="МДФ панели, ЛДСП, фурнитура"
                />
                <span className="text-xs leading-5 text-[var(--muted)]">
                  Короткая подпись на карточках и в промо-блоках. Можно не
                  заполнять.
                </span>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Сценарий заказа
                <Input
                  name="scenario"
                  defaultValue={category.scenario ?? ""}
                  placeholder="Запрос цены, покупка онлайн, расчет распила"
                />
                <span className="text-xs leading-5 text-[var(--muted)]">
                  Помогает команде понимать, как клиент должен работать с этой
                  категорией.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
              <Checkbox
                name="isFeatured"
                defaultChecked={category.isFeatured}
                label="Показывать выше"
                description="Категория получает приоритет в публичных подборках и админских списках."
                className="rounded-xl border-[color:var(--line)] bg-white/55 p-3"
              />
            </div>
          </article>

          <aside className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[#171614] p-5 text-white sm:p-6">
            <p className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
              Подсказка
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              Что важно заполнить
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-white/68">
              <p>
                Название и адрес страницы обязательны: по ним категория
                открывается на сайте.
              </p>
              <p>
                Индикатор и сценарий заказа не обязательны, но помогают сделать
                каталог понятнее для клиента и менеджера.
              </p>
              <p>
                Если в категории уже есть товары, удаление блокируется, чтобы не
                сломать каталог.
              </p>
            </div>
          </aside>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
            <SectionHeading
              title="Описание и витрина"
              description="Тексты и изображения, которые используются на публичной странице категории."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="text-sm leading-6"
            />

            <div className="mt-6 grid gap-4">
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
                  rows={6}
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
                  <span className="text-xs leading-5 text-[var(--muted)]">
                    Можно указать внешнюю ссылку или путь к файлу в public.
                  </span>
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
            </div>
          </article>

          <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
            <SectionHeading
              title="SEO"
              description="Можно оставить пустым: сайт использует название и описание категории."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="text-sm leading-6"
            />

            <div className="mt-6 grid gap-4">
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
                <Textarea
                  name="seoDescription"
                  rows={4}
                  defaultValue={category.seoDescription ?? ""}
                  placeholder="Описание для поисковой выдачи"
                />
              </label>
            </div>
          </article>
        </section>

        <section className="surface-glow sticky bottom-3 z-10 flex flex-col gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 shadow-[0_18px_50px_rgba(30,28,25,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[var(--muted)]">
            После сохранения обновятся админка и публичная страница категории.
          </p>
          <AdminSubmitButton
            type="submit"
            variant="accent"
            className="w-full sm:w-auto"
            idleLabel="Сохранить изменения"
            pendingLabel="Сохраняем..."
          />
        </section>
      </form>
    </div>
  );
}
