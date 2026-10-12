export type InvoiceLine = {
  key: string;
  name: string;
  sku: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  unit: string;
  requiresProductReview?: boolean;
};
export type SalesInvoice = {
  title: string;
  customerName: string;
  fileName: string;
  declaredTotal: number | null;
  lines: InvoiceLine[];
  warnings: string[];
};
export const MAX_SALE_AMOUNT = 2_147_483_647;
export const invoiceMatchKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");

export function validateInvoiceLine(
  line: Pick<InvoiceLine, "quantity" | "unitPrice">,
) {
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity! < 1 ||
    line.quantity! > 999
  )
    return "Количество должно быть целым числом от 1 до 999.";
  if (
    !Number.isInteger(line.unitPrice) ||
    line.unitPrice! < 0 ||
    line.unitPrice! > MAX_SALE_AMOUNT
  )
    return "Цена должна быть целым неотрицательным числом в сомах. Дробная цена требует отдельного учёта.";
  if (line.quantity! * line.unitPrice! > MAX_SALE_AMOUNT)
    return "Сумма позиции превышает допустимое значение.";
  return null;
}

export function parseSalesItemInputs(
  productIds: string[],
  quantities: FormDataEntryValue[],
  prices: FormDataEntryValue[],
) {
  const seen = new Set<string>();
  return productIds.map((productId, index) => {
    const quantity =
      typeof quantities[index] === "string" && String(quantities[index]).trim()
        ? Number(quantities[index])
        : NaN;
    const rawPrice = prices[index];
    const invoicePrice =
      rawPrice === undefined || rawPrice === ""
        ? null
        : typeof rawPrice === "string" && rawPrice.trim()
          ? Number(rawPrice)
          : NaN;
    if (
      !productId ||
      seen.has(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999 ||
      (invoicePrice !== null &&
        validateInvoiceLine({ quantity, unitPrice: invoicePrice }))
    )
      throw new Error("Invalid sales items");
    seen.add(productId);
    return { productId, quantity, invoicePrice };
  });
}

export function matchInvoiceLines<
  T extends { id: string; sku: string; name: string },
>(lines: InvoiceLine[], products: T[]) {
  const bySku = new Map<string, T[]>();
  const byName = new Map<string, T[]>();
  for (const product of products) {
    for (const [map, key] of [
      [bySku, invoiceMatchKey(product.sku)],
      [byName, invoiceMatchKey(product.name)],
    ] as const) {
      if (key) map.set(key, [...(map.get(key) ?? []), product]);
    }
  }
  return lines.map((line) => {
    const matches =
      (line.sku
        ? bySku.get(invoiceMatchKey(line.sku))
        : byName.get(invoiceMatchKey(line.name))) ?? [];
    return {
      ...line,
      product:
        matches.length === 1 && !line.requiresProductReview ? matches[0] : null,
      matchMessage: line.requiresProductReview
        ? "Нечёткое распознавание. Выберите товар вручную."
        : matches.length === 1
          ? line.sku
            ? "По артикулу"
            : "По точному названию"
          : matches.length
            ? "Несколько совпадений. Выберите товар."
            : "Товар не найден. Выберите вручную.",
    };
  });
}
