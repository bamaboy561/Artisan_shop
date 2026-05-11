import { importProductsFromExcelAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InventoryStatus, ProductOrderMode } from "@/generated/prisma";

type Option = { id: string; name: string };
type SlugLabelOption = { slug: string; label: string };

type ProductImportFormProps = {
  categories: Option[];
  brands: Option[];
  calculatorMaterials: SlugLabelOption[];
  calculatorSheetFormats: SlugLabelOption[];
};

const orderModeLabels: Record<ProductOrderMode, string> = {
  [ProductOrderMode.CART]: "В корзину",
  [ProductOrderMode.REQUEST_PRICE]: "Запрос цены",
  [ProductOrderMode.SERVICE]: "Сервисная заявка",
};

const inventoryLabels: Record<InventoryStatus, string> = {
  [InventoryStatus.IN_STOCK]: "В наличии",
  [InventoryStatus.LIMITED]: "Остаток ограничен",
  [InventoryStatus.OUT_OF_STOCK]: "Нет в наличии",
  [InventoryStatus.ON_REQUEST]: "Под запрос",
};

export function ProductImportForm({
  categories,
  brands,
  calculatorMaterials,
  calculatorSheetFormats,
}: ProductImportFormProps) {
  return (
    <form
      action={importProductsFromExcelAction}
      encType="multipart/form-data"
      className="mt-5 grid gap-5"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Файл Excel / 1С
          <Input
            name="productsFile"
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
            required
          />
          <span className="text-xs leading-5 text-[var(--muted)]">
            Поддерживаются XLSX, XLS, CSV и TSV до 10 МБ. Первая таблица
            распознается автоматически.
          </span>
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Категория по умолчанию
          <Select name="defaultCategoryId" defaultValue="">
            <option value="">Брать из файла</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <span className="text-xs leading-5 text-[var(--muted)]">
            Используется, если в файле нет колонки категории.
          </span>
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Бренд по умолчанию
          <Select name="defaultBrandId" defaultValue="">
            <option value="">Брать из файла</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
          <span className="text-xs leading-5 text-[var(--muted)]">
            Можно выбрать бренд поставщика, если прайс содержит только один
            бренд.
          </span>
        </label>
      </div>

      <div className="rounded-[22px] border border-[#eadfd4] bg-[#fbf6ef] p-4 text-sm leading-6 text-[var(--muted)]">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
          Безопасная публикация
        </p>
        <p className="mt-2">
          Новые товары из файла всегда создаются как черновики. Статус из Excel
          не публикует карточку автоматически: менеджер сначала проверяет цену,
          остаток, фото и категорию, а потом публикует выбранные товары массовым
          действием.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Сценарий
          <Select
            name="defaultOrderMode"
            defaultValue={ProductOrderMode.REQUEST_PRICE}
          >
            {Object.values(ProductOrderMode).map((mode) => (
              <option key={mode} value={mode}>
                {orderModeLabels[mode]}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Наличие
          <Select
            name="defaultInventoryStatus"
            defaultValue={InventoryStatus.ON_REQUEST}
          >
            {Object.values(InventoryStatus).map((status) => (
              <option key={status} value={status}>
                {inventoryLabels[status]}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Материал расчета
          <Select name="defaultCalculatorMaterialId" defaultValue="">
            <option value="">Не задавать</option>
            {calculatorMaterials.map((material) => (
              <option key={material.slug} value={material.slug}>
                {material.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Формат листа
          <Select name="defaultCalculatorSheetPresetId" defaultValue="">
            <option value="">Не задавать</option>
            {calculatorSheetFormats.map((sheet) => (
              <option key={sheet.slug} value={sheet.slug}>
                {sheet.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-3 rounded-[22px] border border-[color:var(--line)] bg-[#faf8f4] p-4 lg:grid-cols-4">
        <Checkbox
          name="updateExisting"
          value="on"
          defaultChecked
          label="Обновлять по SKU"
          description="Если артикул уже есть, карточка обновится вместо дубля."
          className="rounded-2xl bg-white/70 px-3 py-3"
        />
        <Checkbox
          name="createMissingRelations"
          value="on"
          defaultChecked
          label="Создавать бренды и категории"
          description="Новые значения из файла будут добавлены автоматически."
          className="rounded-2xl bg-white/70 px-3 py-3"
        />
        <Checkbox
          name="moveUpdatedToDraft"
          value="on"
          label="Обновленные тоже в черновики"
          description="Включите, если нужно снять с витрины товары, которые обновились из файла."
          className="rounded-2xl bg-white/70 px-3 py-3"
        />
        <Checkbox
          name="importAttributes"
          value="on"
          defaultChecked
          label="Лишние колонки в характеристики"
          description="Цвет, декор, покрытие и другие поля сохранятся в карточке."
          className="rounded-2xl bg-white/70 px-3 py-3"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Импорт сам ищет колонки: номенклатура, артикул, цена, остаток, бренд,
          категория, фото, формат и толщина. Неизвестные колонки можно сохранить
          как характеристики товара.
        </p>
        <AdminSubmitButton
          type="submit"
          variant="accent"
          className="w-full sm:w-auto"
          idleLabel="Импортировать товары"
          pendingLabel="Импортируем..."
        />
      </div>
    </form>
  );
}
