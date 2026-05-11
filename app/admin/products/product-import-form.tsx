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
      className="mt-4 grid gap-3"
    >
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
        Файл Excel / 1С
        <Input
          name="productsFile"
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
          required
          className="h-10"
        />
        <span className="text-xs leading-5 text-[var(--muted)]">
          Новые позиции всегда создаются как черновики.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Категория
          <Select name="defaultCategoryId" defaultValue="" className="h-10">
            <option value="">Брать из файла</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Бренд
          <Select name="defaultBrandId" defaultValue="" className="h-10">
            <option value="">Брать из файла</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <details className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-3 open:bg-white/86">
        <summary className="cursor-pointer list-none font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
          Параметры импорта
        </summary>

        <div className="mt-3 grid gap-3 border-t border-[color:var(--line)] pt-3">
          <div className="rounded-2xl border border-[#eadfd4] bg-[#fbf6ef] p-3 text-xs leading-5 text-[var(--muted)]">
            Статус из Excel игнорируется для новых товаров: сначала проверка,
            потом публикация через массовое действие.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
              Сценарий
              <Select
                name="defaultOrderMode"
                defaultValue={ProductOrderMode.REQUEST_PRICE}
                className="h-10"
              >
                {Object.values(ProductOrderMode).map((mode) => (
                  <option key={mode} value={mode}>
                    {orderModeLabels[mode]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
              Наличие
              <Select
                name="defaultInventoryStatus"
                defaultValue={InventoryStatus.ON_REQUEST}
                className="h-10"
              >
                {Object.values(InventoryStatus).map((status) => (
                  <option key={status} value={status}>
                    {inventoryLabels[status]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
              Материал расчета
              <Select name="defaultCalculatorMaterialId" defaultValue="" className="h-10">
                <option value="">Не задавать</option>
                {calculatorMaterials.map((material) => (
                  <option key={material.slug} value={material.slug}>
                    {material.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
              Формат листа
              <Select name="defaultCalculatorSheetPresetId" defaultValue="" className="h-10">
                <option value="">Не задавать</option>
                {calculatorSheetFormats.map((sheet) => (
                  <option key={sheet.slug} value={sheet.slug}>
                    {sheet.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid gap-2">
            <Checkbox
              name="updateExisting"
              value="on"
              defaultChecked
              label="Обновлять по SKU"
              description="Если артикул уже есть, карточка обновится вместо дубля."
              className="rounded-2xl bg-[#faf8f4] px-3 py-2"
            />
            <Checkbox
              name="createMissingRelations"
              value="on"
              defaultChecked
              label="Создавать бренды и категории"
              description="Новые значения из файла будут добавлены автоматически."
              className="rounded-2xl bg-[#faf8f4] px-3 py-2"
            />
            <Checkbox
              name="moveUpdatedToDraft"
              value="on"
              label="Обновленные тоже в черновики"
              description="Если нужно снять с витрины товары, обновленные из файла."
              className="rounded-2xl bg-[#faf8f4] px-3 py-2"
            />
            <Checkbox
              name="importAttributes"
              value="on"
              defaultChecked
              label="Лишние колонки в характеристики"
              description="Цвет, декор, покрытие и другие поля сохранятся в карточке."
              className="rounded-2xl bg-[#faf8f4] px-3 py-2"
            />
          </div>
        </div>
      </details>

      <AdminSubmitButton
        type="submit"
        variant="accent"
        className="h-10 w-full"
        idleLabel="Импортировать"
        pendingLabel="Импортируем..."
      />
    </form>
  );
}
