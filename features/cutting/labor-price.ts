export type CuttingLaborPrice = {
  sheetRate: number;
  edgeRate: number;
};

export function parseCuttingLaborPrice(
  value: unknown,
): CuttingLaborPrice | null {
  if (!value || typeof value !== "object") return null;
  const { sheetRate, edgeRate } = value as CuttingLaborPrice;
  if (
    ![sheetRate, edgeRate].every(
      (rate) =>
        typeof rate === "number" &&
        Number.isFinite(rate) &&
        rate >= 0 &&
        rate <= 100000 &&
        Math.abs(rate * 100 - Math.round(rate * 100)) < 0.000001,
    )
  )
    return null;
  return { sheetRate, edgeRate };
}

export function calculateCuttingLaborTotal(
  price: CuttingLaborPrice,
  sheets: number | null | undefined,
  edgeMeters: number | null | undefined,
  edgeOption?: string | null,
) {
  if (!Number.isInteger(sheets) || !sheets || sheets < 1 || sheets > 10000)
    return null;
  // A named edge without measured length is incomplete, not free work.
  const meters = edgeMeters ?? (edgeOption?.trim() ? null : 0);
  if (
    meters === null ||
    !Number.isFinite(meters) ||
    meters < 0 ||
    meters > 100000
  )
    return null;
  const total = Math.round(
    (sheets * Math.round(price.sheetRate * 100) +
      meters * Math.round(price.edgeRate * 100)) /
      100,
  );
  if (total > 2147483647) throw new Error("Сумма работ слишком большая.");
  return total;
}
