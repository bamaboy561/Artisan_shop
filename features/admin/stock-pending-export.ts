import * as XLSX from "xlsx";

export type StockPendingExportItem = {
  sku: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
};

// Колонки совпадают с полным импортом товаров: файл можно дополнить
// категорией, ценой и фото и загрузить обратно как новые карточки.
export const stockPendingExportHeaders = [
  "Название",
  "Артикул / SKU",
  "Категория",
  "Бренд",
  "Цена",
  "Остаток",
  "Краткое описание",
  "Описание",
  "Изображение",
  "Ед. изм. в 1С",
];

export function createStockPendingExport(items: StockPendingExportItem[]) {
  const rows = items.map((item) => [
    item.name,
    item.sku ?? "",
    "",
    "",
    "",
    // На сайте остаток целый: кромку в метрах округляем вниз, как при сверке.
    item.quantity === null ? "" : Math.max(0, Math.floor(item.quantity)),
    "",
    "",
    "",
    item.unit ?? "",
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([stockPendingExportHeaders, ...rows]);
  sheet["!cols"] = [
    { wch: 60 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
    { wch: 40 },
    { wch: 40 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Добавить на сайт");
  return new Uint8Array(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  );
}
