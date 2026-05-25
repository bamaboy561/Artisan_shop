import Link from "next/link";

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
          "Загрузите стартовые данные через prisma db seed.",
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

      <section className="grid items-start gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6 2xl:sticky 2xl:top-24">
          <SectionHeading
            title="Новый бренд"
            description="Добавьте производителя, сайт и логотип. Подробности можно доработать в карточке бренда."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-6"
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
              <label className="grid gap-2 text-sm text-[var(--foreground)] sm:col-span-2">
                Логотип
                <Input
                  name="logoUrl"
                  type="url"
                  placeholder="https://brand.com/logo.svg"
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/55 p-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                  Баннер на главной
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Можно добавить до 4 фото. Они соберутся в большой брендовый
                  баннер на главной странице.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((index) => (
                  <label
                    key={index}
                    className="grid gap-2 text-sm text-[var(--foreground)]"
                  >
                    Фото {index}
                    <Input
                      name="homeBannerImageUrl"
                      type="url"
                      placeholder="https://site.com/banner.jpg"
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Описание
              <Textarea
                name="description"
                rows={4}
                placeholder="Короткое описание бренда для страницы и карточек."
              />
            </label>

            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить бренд
            </Button>
          </form>
        </article>

        <article className="surface-glow min-w-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)]">
          <div className="flex flex-col gap-4 border-b border-[color:var(--line)] p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="Список брендов"
              description="Логотип, описание, привязанные товары и быстрые действия без перегруженной таблицы."
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="max-w-2xl text-sm leading-6"
            />

            <StatusBadge tone="neutral" className="shrink-0">
              {brands.length} брендов
            </StatusBadge>
          </div>

          {brands.length > 0 ? (
            <div className="grid gap-3 p-4 sm:p-5">
              {brands.map((brand) => {
                const canDelete = brand._count.products === 0;
                const initial = brand.name.trim().slice(0, 1).toUpperCase();
                const logoStyle = brand.logoUrl
                  ? { backgroundImage: `url(${brand.logoUrl})` }
                  : undefined;

                return (
                  <section
                    key={brand.id}
                    className="grid min-w-0 gap-4 rounded-[22px] border border-[color:var(--line)] bg-white/78 p-4 transition hover:border-[#d8cec2] hover:bg-white sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                      <div
                        className="flex h-16 w-32 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[#171614] bg-contain bg-center bg-no-repeat text-lg font-semibold text-white shadow-[0_14px_34px_rgba(17,17,17,0.08)] sm:h-[4.5rem] sm:w-36"
                        style={logoStyle}
                        aria-label={`Логотип ${brand.name}`}
                      >
                        {brand.logoUrl ? null : initial || "A"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/brands/${brand.id}`}
                            className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] transition hover:text-[#9d573d]"
                          >
                            {brand.name}
                          </Link>
                          <span className="rounded-full border border-[color:var(--line)] bg-[#f7f4ef] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                            {brand.slug}
                          </span>
                        </div>

                        <p className="mt-3 max-w-4xl text-sm leading-6 break-words text-[var(--muted)]">
                          {brand.description ??
                            "Описание бренда пока не добавлено."}
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
                          <span className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1">
                            {brand.logoUrl
                              ? "Логотип добавлен"
                              : "Без логотипа"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:min-w-[168px] xl:flex-col xl:items-stretch">
                      <StatusBadge tone="accent" className="justify-center">
                        {String(brand._count.products)} товаров
                      </StatusBadge>

                      <Link
                        href={`/admin/brands/${brand.id}`}
                        className="inline-flex h-10 items-center justify-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
                      >
                        Редактировать
                      </Link>

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
              После добавления первых брендов они появятся в этом списке.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
