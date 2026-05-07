import {
  createCalculatorMaterialAction,
  createCalculatorSheetFormatAction,
  deleteCalculatorMaterialAction,
  deleteCalculatorSheetFormatAction,
  updateCalculatorMaterialAction,
  updateCalculatorSheetFormatAction,
} from "@/app/admin/actions";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getCalculatorAdminData() {
  const db = getDb();
  const [materials, sheetFormats] = await Promise.all([
    db.calculatorMaterial.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    db.calculatorSheetFormat.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);
  return { materials, sheetFormats };
}

export default async function AdminCalculatorPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Конфиг калькулятора будет доступен после настройки БД"
        description="Здесь редактируются материалы (цены за квадрат, рез, кромка) и форматы листов, которые видит публичный калькулятор."
        steps={[
          "Укажите DATABASE_URL в .env.",
          "Примените схему через prisma db push.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/calculator");

  const { materials, sheetFormats } = await getCalculatorAdminData();

  const materialRows = materials.map((material) => ({
    info: (
      <form
        id={`material-update-${material.id}`}
        action={updateCalculatorMaterialAction}
        className="grid gap-2"
      >
        <input type="hidden" name="id" value={material.id} />
        <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          {material.slug}
        </p>
        <Input
          name="label"
          defaultValue={material.label}
          className="h-9 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-[var(--muted)]">
            Толщина, мм
            <Input
              name="thicknessMm"
              type="number"
              min="0"
              defaultValue={material.thicknessMm ?? ""}
              className="h-9 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--muted)]">
            Сорт.
            <Input
              name="sortOrder"
              type="number"
              defaultValue={material.sortOrder}
              className="h-9 text-sm"
            />
          </label>
        </div>
        <Checkbox
          name="isActive"
          value="on"
          defaultChecked={material.isActive}
          label="Доступен в калькуляторе"
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" size="sm">
            Сохранить
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            formAction={deleteCalculatorMaterialAction}
            className="text-red-600 hover:bg-red-50"
          >
            Удалить
          </Button>
        </div>
      </form>
    ),
    pricing: (
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Цена за м², сом
          <Input
            form={`material-update-${material.id}`}
            name="pricePerSqM"
            type="number"
            min="0"
            defaultValue={material.pricePerSqM}
            className="h-9 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Цена реза за м, сом
          <Input
            form={`material-update-${material.id}`}
            name="cutRatePerMeter"
            type="number"
            min="0"
            defaultValue={material.cutRatePerMeter}
            className="h-9 text-sm"
          />
        </label>
      </div>
    ),
    extras: (
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Кромка за м, сом
          <Input
            form={`material-update-${material.id}`}
            name="edgeRatePerMeter"
            type="number"
            min="0"
            defaultValue={material.edgeRatePerMeter}
            className="h-9 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Setup-fee, сом
          <Input
            form={`material-update-${material.id}`}
            name="setupFee"
            type="number"
            min="0"
            defaultValue={material.setupFee}
            className="h-9 text-sm"
          />
        </label>
      </div>
    ),
    status: (
      <StatusBadge tone={material.isActive ? "success" : "neutral"}>
        {material.isActive ? "Активен" : "Скрыт"}
      </StatusBadge>
    ),
  }));

  const sheetRows = sheetFormats.map((sheet) => ({
    info: (
      <form
        id={`sheet-update-${sheet.id}`}
        action={updateCalculatorSheetFormatAction}
        className="grid gap-2"
      >
        <input type="hidden" name="id" value={sheet.id} />
        <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          {sheet.slug}
        </p>
        <Input
          name="label"
          defaultValue={sheet.label}
          className="h-9 text-sm"
        />
        <Checkbox
          name="isActive"
          value="on"
          defaultChecked={sheet.isActive}
          label="Доступен в калькуляторе"
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" size="sm">
            Сохранить
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            formAction={deleteCalculatorSheetFormatAction}
            className="text-red-600 hover:bg-red-50"
          >
            Удалить
          </Button>
        </div>
      </form>
    ),
    dimensions: (
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Ширина, мм
          <Input
            form={`sheet-update-${sheet.id}`}
            name="widthMm"
            type="number"
            min="0"
            defaultValue={sheet.widthMm}
            className="h-9 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Высота, мм
          <Input
            form={`sheet-update-${sheet.id}`}
            name="heightMm"
            type="number"
            min="0"
            defaultValue={sheet.heightMm}
            className="h-9 text-sm"
          />
        </label>
      </div>
    ),
    sort: (
      <Input
        form={`sheet-update-${sheet.id}`}
        name="sortOrder"
        type="number"
        defaultValue={sheet.sortOrder}
        className="h-9 w-20 text-sm"
      />
    ),
    status: (
      <StatusBadge tone={sheet.isActive ? "success" : "neutral"}>
        {sheet.isActive ? "Активен" : "Скрыт"}
      </StatusBadge>
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Калькулятор распила"
          description="Материалы, цены и форматы листов, которые видит публичный калькулятор. Изменения мгновенно подхватываются."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
          <SectionHeading
            title="Новый материал"
            description="ЛДСП, МДФ, фанера и другие плитные материалы для расчёта."
            titleClassName="text-xl"
            descriptionClassName="text-sm leading-7"
          />

          <form action={createCalculatorMaterialAction} className="mt-6 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="ldsp-16" required />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Название
                <Input name="label" placeholder="ЛДСП 16 мм" required />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Цена за м², сом
                <Input
                  name="pricePerSqM"
                  type="number"
                  min="0"
                  placeholder="610"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Рез за м, сом
                <Input
                  name="cutRatePerMeter"
                  type="number"
                  min="0"
                  placeholder="38"
                  required
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Кромка за м, сом
                <Input
                  name="edgeRatePerMeter"
                  type="number"
                  min="0"
                  placeholder="28"
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Setup-fee, сом
                <Input
                  name="setupFee"
                  type="number"
                  min="0"
                  placeholder="950"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Толщина, мм
                <Input
                  name="thicknessMm"
                  type="number"
                  min="0"
                  placeholder="16"
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Порядок
                <Input name="sortOrder" type="number" defaultValue={0} />
              </label>
            </div>
            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить материал
            </Button>
          </form>
        </article>

        <DataTable
          columns={[
            { key: "info", label: "Материал" },
            { key: "pricing", label: "Цены" },
            { key: "extras", label: "Доп" },
            { key: "status", label: "Статус" },
          ]}
          rows={materialRows}
          caption="Материалы калькулятора"
          emptyMessage="Добавьте первый материал — он сразу появится в публичном калькуляторе."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
          <SectionHeading
            title="Новый формат листа"
            description="Стандартные размеры листа: 2800 × 2070, 2750 × 1830 и т.д."
            titleClassName="text-xl"
            descriptionClassName="text-sm leading-7"
          />

          <form
            action={createCalculatorSheetFormatAction}
            className="mt-6 grid gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="2800x2070" required />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Название
                <Input name="label" placeholder="2800 × 2070 мм" required />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Ширина, мм
                <Input
                  name="widthMm"
                  type="number"
                  min="0"
                  placeholder="2800"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Высота, мм
                <Input
                  name="heightMm"
                  type="number"
                  min="0"
                  placeholder="2070"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--foreground)]">
                Порядок
                <Input name="sortOrder" type="number" defaultValue={0} />
              </label>
            </div>
            <Button type="submit" variant="accent" className="w-full sm:w-auto">
              Добавить формат
            </Button>
          </form>
        </article>

        <DataTable
          columns={[
            { key: "info", label: "Формат" },
            { key: "dimensions", label: "Размеры" },
            { key: "sort", label: "Порядок" },
            { key: "status", label: "Статус" },
          ]}
          rows={sheetRows}
          caption="Форматы листов"
          emptyMessage="После добавления первого формата он будет доступен в калькуляторе."
        />
      </section>
    </div>
  );
}
