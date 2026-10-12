import * as XLSX from "xlsx";
import {
  invoiceMatchKey,
  type SalesInvoice,
} from "@/features/admin/sales-invoice-model";
const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || text(value) === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : Number(
          text(value)
            .replace(/[\s\u00a0]/g, "")
            .replace(",", "."),
        );
  return Number.isFinite(parsed) ? parsed : null;
};

export async function parseSalesInvoice(file: File): Promise<SalesInvoice> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const result: SalesInvoice = {
    title: "",
    customerName: "",
    fileName: file.name,
    declaredTotal: null,
    lines: [],
    warnings: [],
  };
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    if (!range) continue;
    if (range.e.r > 20000 || range.e.c > 250)
      throw new Error(
        "Слишком большая область таблицы. Оставьте только накладную.",
      );
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });
    const headerIndex = rows.findIndex((row) => {
      const cells = row.map((cell) => invoiceMatchKey(text(cell)));
      return (
        cells.some((cell) =>
          ["товар", "наименование", "номенклатура"].includes(cell),
        ) &&
        cells.includes("количество") &&
        cells.includes("цена")
      );
    });
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell) =>
      invoiceMatchKey(text(cell)),
    );
    const column = (...names: string[]) =>
      headers.findIndex((cell) => names.includes(cell));
    const nameCol = column("товар", "наименование", "номенклатура");
    const qtyCol = column("количество");
    const priceCol = column("цена");
    const amountCol = column("сумма");
    const skuCol = column("артикул", "sku", "код");
    const indexCol = column("№", "номер");
    const unitCol = column("ед.изм", "ед. изм.", "единица измерения");
    for (const row of rows.slice(0, headerIndex)) {
      const values = row.map(text).filter(Boolean);
      const title = values.find((value) => /накладная/i.test(value));
      if (title && !result.title) result.title = title;
      const buyer = values.findIndex((value) => /^покупатель\s*:/i.test(value));
      if (buyer >= 0 && !result.customerName)
        result.customerName = values[buyer + 1] ?? "";
    }
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index];
      if (row.some((cell) => /^(к оплате|всего|итого)\s*:/i.test(text(cell)))) {
        const total = amountCol >= 0 ? number(row[amountCol]) : null;
        if (total !== null) result.declaredTotal = total;
        continue;
      }
      const name = text(row[nameCol]);
      if (!name || (indexCol >= 0 && !/^\d+$/.test(text(row[indexCol]))))
        continue;
      result.lines.push({
        key: JSON.stringify([sheetName, index + range.s.r + 1]),
        name,
        sku: skuCol >= 0 ? text(row[skuCol]) : "",
        quantity: number(row[qtyCol]),
        unitPrice: number(row[priceCol]),
        amount: amountCol >= 0 ? number(row[amountCol]) : null,
        unit:
          unitCol >= 0
            ? text(row[unitCol])
            : (row
                .slice(qtyCol + 1, priceCol)
                .map(text)
                .find((value) =>
                  /^(шт|м|пог\.?\s*м|л\.?|компл)\.?$/i.test(value),
                ) ?? ""),
      });
      if (result.lines.length > 500)
        throw new Error(
          "В накладной больше 500 позиций. Разделите файл; строки не загружены.",
        );
    }
  }
  if (!result.lines.length)
    throw new Error(
      "Не найдена таблица с колонками «Товар», «Количество», «Цена».",
    );
  if (workbook.SheetNames.length > 1)
    result.warnings.push(
      "В файле несколько листов. Проверьте состав и итог каждой накладной.",
    );
  return result;
}
