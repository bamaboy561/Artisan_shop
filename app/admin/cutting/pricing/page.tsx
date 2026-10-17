import Link from "next/link";
import { RoleCode } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  getCuttingPrice,
  getSiteCuttingPrices,
} from "@/lib/server/cutting-pricing";
import { drillingDiameters } from "@/features/cutting/site-prices";
import { saveCuttingPriceAction, saveSiteCuttingPricesAction } from "./actions";
import { Input } from "@/components/ui/input";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export default async function CuttingPricingPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    siteSaved?: string;
    siteError?: string;
  }>;
}) {
  const session = await requireAdminSession("/login", "/admin/cutting/pricing");
  const [price, sitePrices] = await Promise.all([
    getCuttingPrice(),
    getSiteCuttingPrices(),
  ]);
  const query = await searchParams;
  const canEdit =
    session.roleCode === RoleCode.ADMIN ||
    session.roleCode === RoleCode.SUPER_ADMIN;
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/cutting" className="text-sm underline">
        Распил
      </Link>
      <h1 className="text-2xl font-semibold">Прайс работ</h1>
      <SitePricesForm
        prices={sitePrices}
        canEdit={canEdit}
        saved={Boolean(query.siteSaved)}
        error={Boolean(query.siteError)}
      />
      <div className="grid gap-1 border-t border-zinc-200 pt-6">
        <h2 className="text-lg font-semibold">Расчёт заявок в админке</h2>
        <p className="text-sm text-zinc-600">
          По этим тарифам считает кнопка «Рассчитать по прайсу» в заявке на
          распил. На цены на сайте они не влияют.
        </p>
      </div>
      {query.saved ? (
        <p role="status" className="text-emerald-700">
          Тарифы для заявок сохранены.
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="text-red-700">
          Заполните оба тарифа от 0 до 100 000 сом, не более двух знаков после
          запятой. Требуется подключённая база данных.
        </p>
      ) : null}
      <form action={saveCuttingPriceAction} className="grid gap-5">
        <label className="grid gap-2 text-sm font-medium">
          Распил, сом за лист
          <Input
            name="sheetRate"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            defaultValue={price?.sheetRate ?? ""}
            disabled={!canEdit}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Кромление, сом за погонный метр
          <Input
            name="edgeRate"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            defaultValue={price?.edgeRate ?? ""}
            disabled={!canEdit}
          />
        </label>
        {canEdit ? (
          <AdminSubmitButton
            type="submit"
            idleLabel="Сохранить тарифы для заявок"
            pendingLabel="Сохраняем..."
          />
        ) : null}
      </form>
    </section>
  );
}

function PriceField({
  label,
  name,
  value,
  disabled,
}: {
  label: string;
  name: string;
  value: number;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        name={name}
        type="number"
        min="0"
        max="100000"
        step="0.01"
        required
        defaultValue={value}
        disabled={disabled}
      />
    </label>
  );
}

function SitePricesForm({
  prices,
  canEdit,
  saved,
  error,
}: {
  prices: Awaited<ReturnType<typeof getSiteCuttingPrices>>;
  canEdit: boolean;
  saved: boolean;
  error: boolean;
}) {
  return (
    <form action={saveSiteCuttingPricesAction} className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Цены на сайте</h2>
        <p className="text-sm text-zinc-600">
          Калькулятор распила, плашка «Раскрой через сайт дешевле» на главной и
          в каталоге, присадка в проектах Базиса. Меняются сразу после
          сохранения.
        </p>
      </div>
      {saved ? (
        <p role="status" className="text-emerald-700">
          Цены на сайте сохранены.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-700">
          Заполните все цены от 0 до 100 000 сом, не более двух знаков после
          запятой. Требуется подключённая база данных.
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <PriceField
          label="Распил через сайт, сом за лист"
          name="siteSheet"
          value={prices.sheet}
          disabled={!canEdit}
        />
        <PriceField
          label="Обычный распил, сом за лист"
          name="siteSheetRegular"
          value={prices.sheetRegular}
          disabled={!canEdit}
        />
        <PriceField
          label="Кромление через сайт, сом за метр"
          name="siteEdge"
          value={prices.edge}
          disabled={!canEdit}
        />
        <PriceField
          label="Обычное кромление, сом за метр"
          name="siteEdgeRegular"
          value={prices.edgeRegular}
          disabled={!canEdit}
        />
      </div>
      <p className="text-xs text-zinc-500">
        Обычная цена показывается зачёркнутой рядом с ценой через сайт. Если
        цена через сайт не ниже обычной, плашка со скидкой не показывается.
      </p>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">
          Присадка, сом за одно отверстие
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {drillingDiameters.map((diameter) => (
            <PriceField
              key={diameter}
              label={`Ø${diameter} мм`}
              name={`drill${diameter}`}
              value={prices.drilling[diameter]}
              disabled={!canEdit}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <PriceField
          label="Фрезеровка криволинейки (скругления), сом за метр"
          name="siteMilling"
          value={prices.milling}
          disabled={!canEdit}
        />
        <PriceField
          label="Пропил под углом (скосы торцов), сом за метр"
          name="siteBevel"
          value={prices.bevel}
          disabled={!canEdit}
        />
      </div>
      {canEdit ? (
        <AdminSubmitButton
          type="submit"
          idleLabel="Сохранить цены на сайте"
          pendingLabel="Сохраняем..."
        />
      ) : null}
    </form>
  );
}
