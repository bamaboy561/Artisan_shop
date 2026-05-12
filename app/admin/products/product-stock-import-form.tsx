import { updateProductStockFromExcelAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function ProductStockImportForm() {
  return (
    <form
      action={updateProductStockFromExcelAction}
      encType="multipart/form-data"
      className="mt-4 grid gap-3"
    >
      <div className="rounded-2xl border border-[#eadfd4] bg-[#fbf6ef] p-3 text-xs leading-5 text-[var(--muted)]">
        Быстрый режим ничего не создает и не меняет описание товара. Он ищет
        существующую карточку по артикулу/SKU и обновляет только цену, остаток и
        наличие.
      </div>

      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]">
        Файл цен и остатков
        <Input
          name="stockFile"
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
          required
          className="h-10"
        />
        <span className="text-xs leading-5 text-[var(--muted)]">
          Достаточно колонок: Артикул, Цена, Остаток, Наличие.
        </span>
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox
          name="updatePrice"
          value="on"
          defaultChecked
          label="Обновлять цены"
          description="Цена берется из колонки Цена, Прайс или Розничная цена."
          className="rounded-2xl bg-[#faf8f4] px-3 py-2"
        />
        <Checkbox
          name="updateStock"
          value="on"
          defaultChecked
          label="Обновлять остатки"
          description="Количество берется из колонки Остаток или Количество."
          className="rounded-2xl bg-[#faf8f4] px-3 py-2"
        />
        <Checkbox
          name="updateAvailability"
          value="on"
          defaultChecked
          label="Обновлять наличие"
          description="Берем статус из файла или считаем по остатку."
          className="rounded-2xl bg-[#faf8f4] px-3 py-2"
        />
        <Checkbox
          name="zeroMissingAsOut"
          value="on"
          label="Нет остатка = нет в наличии"
          description="Если остаток 0, товар станет недоступен для покупки."
          className="rounded-2xl bg-[#faf8f4] px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AdminSubmitButton
          type="submit"
          variant="accent"
          className="h-10 w-full sm:w-auto"
          idleLabel="Обновить цены и остатки"
          pendingLabel="Обновляем..."
        />
        <a
          href="/templates/product-stock-update-template.csv"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--line-strong)] px-4 text-xs font-semibold text-[var(--foreground)] transition hover:border-[color:var(--foreground)]"
        >
          Скачать шаблон CSV
        </a>
      </div>
    </form>
  );
}
