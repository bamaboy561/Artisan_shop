import Link from "next/link";

import { SetupState } from "@/components/admin/setup-state";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountFavorites, getAccountUser } from "@/lib/server/account-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | null) {
  if (value === null) {
    return "По запросу";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function AccountFavoritesPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Избранное станет рабочим после подключения базы данных"
        description="Здесь будут храниться материалы и товары для быстрых повторных заказов и проектных подборок."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы загрузить каталог и пользователей.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const favorites = await getAccountFavorites(user.id);

  const rows = favorites.map((favorite) => ({
    product: (
      <div className="space-y-1">
        <Link
          href={`/product/${favorite.product.slug}`}
          className="font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {favorite.product.name}
        </Link>
        <p className="text-xs text-[var(--muted)]">
          {favorite.product.brand?.name ?? "Без бренда"} ·{" "}
          {favorite.product.sku}
        </p>
      </div>
    ),
    orderMode: favorite.product.orderMode,
    price: formatCurrency(favorite.product.price),
  }));

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Избранное"
          description="Сохранённые позиции для повторных заказов, быстрых подборок и согласований внутри проекта."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>

      <DataTable
        columns={[
          { key: "product", label: "Товар" },
          { key: "orderMode", label: "Сценарий заказа" },
          { key: "price", label: "Цена" },
        ]}
        rows={rows}
        caption="Избранные товары"
        emptyMessage="Пока в избранном нет сохранённых позиций."
      />

      <div className="flex justify-start">
        <ButtonLink href="/catalog" variant="secondary">
          Перейти в каталог
        </ButtonLink>
      </div>
    </div>
  );
}
