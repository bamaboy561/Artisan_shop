import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/ui/table";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminPermission } from "@/lib/auth/dal";
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

  await requireAdminPermission("/admin/brands", "/login?next=/admin/brands");

  const brands = await getAdminBrands();

  const rows = brands.map((brand) => ({
    brand: (
      <div className="space-y-1">
        <Link
          href={`/admin/brands/${brand.id}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[#9d573d]"
        >
          {brand.name}
        </Link>
        <p className="text-[11px] text-[var(--muted)]">{brand.slug}</p>
      </div>
    ),
    country: (
      <span className="text-sm whitespace-nowrap text-[var(--foreground)]">
        {brand.country ?? "Не указана"}
      </span>
    ),
    description: (
      <p className="line-clamp-2 max-w-[24rem] text-xs leading-5 text-[var(--muted)]">
        {brand.description ?? "Описание бренда пока не добавлено."}
      </p>
    ),
    linked: (
      <StatusBadge tone="accent">
        {String(brand._count.products)} товаров
      </StatusBadge>
    ),
    actions: (
      <div className="flex flex-col items-start gap-1.5">
        <Link
          href={`/admin/brands/${brand.id}`}
          className="inline-flex h-9 items-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
        >
          Редактировать
        </Link>
        <form action={deleteBrandAction}>
          <input type="hidden" name="id" value={brand.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={brand._count.products > 0}
            className="h-8 px-2 text-[11px] text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
          >
            Удалить
          </Button>
        </form>
      </div>
    ),
  }));

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

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 2xl:self-start">
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

        <DataTable
          columns={[
            { key: "brand", label: "Бренд" },
            { key: "country", label: "Страна" },
            { key: "linked", label: "Товары" },
            { key: "actions", label: "Действия" },
          ]}
          rows={rows}
          caption="Бренды"
          emptyMessage="После добавления первых брендов они появятся в этом списке."
        />
      </section>
    </div>
  );
}
