import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import { getAdminBrands } from "@/lib/server/catalog-admin";
import { createBrandAction, deleteBrandAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Бренды будут доступны после настройки БД"
        description="Раздел уже подготовлен под реальное управление производителями и поставщиками каталога."
        steps={[
          "Укажите DATABASE_URL в .env.",
          "Создайте таблицы через prisma db push.",
          "Создайте реальные бренды вручную или импортом перед публикацией каталога.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/brands");

  const brands = await getAdminBrands();

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Бренды и поставщики"
          description="Здесь формируется пул производителей для каталога, карточек товара и будущей фильтрации."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
          <SectionHeading
            title="Новый бренд"
            description="Быстрое добавление бренда для работы каталога и карточек."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />

          <form action={createBrandAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Название
                <Input name="name" placeholder="Swiss Krono" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="swiss-krono" required />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Страна
                <Input name="country" placeholder="Швейцария / Польша" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Сайт
                <Input
                  name="website"
                  type="url"
                  placeholder="https://brand.com"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Описание
              <Textarea
                name="description"
                rows={5}
                placeholder="Короткое описание бренда для страницы и карточек."
              />
            </label>

            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить бренд
            </Button>
          </form>
        </article>

        <article className="surface-glow min-w-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <div className="flex flex-col gap-4 border-b border-[color:var(--line)] p-6 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="Список брендов"
              description="Все поставщики и производители каталога в удобном рабочем виде."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="text-sm leading-7"
            />

            <StatusBadge tone="neutral" className="shrink-0">
              {brands.length} брендов
            </StatusBadge>
          </div>

          {brands.length > 0 ? (
            <div className="divide-y divide-[color:var(--line)]">
              {brands.map((brand) => {
                const initial = brand.name.trim().slice(0, 1).toUpperCase();
                const canDelete = brand._count.products === 0;

                return (
                  <div
                    key={brand.id}
                    className="grid min-w-0 gap-4 p-5 transition hover:bg-[#faf8f5] lg:grid-cols-[minmax(0,1fr)_auto] lg:p-6"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#171614] text-base font-semibold text-white">
                          {initial || "A"}
                        </div>

                        <div className="min-w-0">
                          <p className="text-lg font-semibold leading-tight text-[var(--foreground)]">
                            {brand.name}
                          </p>
                          <p className="mt-1 break-all font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                            {brand.slug}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 max-w-3xl text-sm leading-6 break-words text-[var(--muted)]">
                        {brand.description ?? "Описание бренда пока не добавлено."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1">
                          {brand.country ?? "Страна не указана"}
                        </span>
                        {brand.website ? (
                          <a
                            href={brand.website}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 text-[var(--foreground)] transition hover:border-[color:var(--foreground)]"
                          >
                            Сайт бренда
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:min-w-[132px] lg:flex-col lg:items-end lg:justify-start">
                      <StatusBadge tone="accent">
                        {String(brand._count.products)} товаров
                      </StatusBadge>

                      <form action={deleteBrandAction}>
                        <input type="hidden" name="id" value={brand.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "Удалить бренд"
                              : "Нельзя удалить бренд, пока к нему привязаны товары"
                          }
                          className="text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
                        >
                          Удалить
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              После добавления первых брендов они появятся в этом списке.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
