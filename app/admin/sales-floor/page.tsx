import { ShoppingBag } from "lucide-react";

import { SalesFloorForm } from "@/app/admin/sales-floor/sales-floor-form";
import { SetupState } from "@/components/admin/setup-state";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import { getSalesFloorData } from "@/lib/server/sales-floor";

export const dynamic = "force-dynamic";

type SalesFloorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  empty: "Выберите клиента и хотя бы один товар.",
  "not-found":
    "Клиент или товары не найдены. Обновите страницу и попробуйте еще раз.",
};

function getErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const value = searchParams.error;
  const key = Array.isArray(value) ? value[0] : value;

  return key ? errorMessages[key] : null;
}

export default async function SalesFloorPage({
  searchParams,
}: SalesFloorPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Продажа в зале заработает после подключения базы"
        description="Менеджер сможет выбрать клиента, собрать товары, сохранить продажу в историю кабинета и начислить бонусы."
        steps={[
          "Подключите DATABASE_URL.",
          "Создайте клиентов в личном кабинете или админке.",
          "Добавьте товары с ценой и статусом опубликован.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/sales-floor");

  const [data, resolvedSearchParams] = await Promise.all([
    getSalesFloorData(),
    searchParams,
  ]);
  const errorMessage = getErrorMessage(resolvedSearchParams);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-[#24231f] bg-[#141411] text-white shadow-[0_22px_70px_rgba(20,20,17,0.18)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.24em] text-white/42 uppercase">
              Рабочее место менеджера
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Продажа в зале
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Выберите клиента, добавьте товары, примените скидку и сохраните
              продажу. Заказ попадет в CRM со статусом “Новый”, а клиент увидит
              покупку и бонусы в личном кабинете.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-3xl bg-white/[0.075] p-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#111]">
              <ShoppingBag className="size-6" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-sm text-white/50">Доступно</p>
              <p className="text-xl font-semibold">
                {data.products.length} товаров
              </p>
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <SalesFloorForm customers={data.customers} products={data.products} />
    </div>
  );
}
