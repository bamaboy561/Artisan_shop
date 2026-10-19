import type { BazisDrilling } from "@/lib/bazis-b3d";
import { formatPrice } from "@/lib/commerce";
import { useSiteCuttingPrices } from "@/features/cutting/site-prices-context";
import { drillingHolePrice } from "@/lib/drilling-price";

const diameterFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

export function formatDrillingRow(row: BazisDrilling["rows"][number]) {
  return [
    row.face > 0 ? `в пласть ${row.face}` : "",
    row.edge > 0 ? `в торец ${row.edge}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function drillingDiameter(diameter: number) {
  return `Ø${diameterFormatter.format(diameter)} мм`;
}

// Присадка из проекта Базиса: сколько отверстий просверлить в деталях.
// В старых сохранённых проектах этих данных нет, тогда блок не показан.
export function DrillingSummary({
  drilling,
}: {
  drilling: BazisDrilling | undefined;
}) {
  const prices = useSiteCuttingPrices();
  if (!drilling || drilling.holes === 0) {
    return null;
  }

  const priced = drilling.rows.map((row) => {
    const holes = row.face + row.edge;
    const price = drillingHolePrice(row.diameter, prices.drilling);
    return { ...row, holes, price, cost: (price ?? 0) * holes };
  });
  const total = priced.reduce((sum, row) => sum + row.cost, 0);
  const unpriced = priced.some((row) => row.price === null);

  return (
    <section className="grid gap-3 bg-[var(--surface-strong)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Присадка
        </h2>
        <p className="text-sm text-[var(--foreground)]">
          Всего отверстий:{" "}
          <span className="font-semibold">{drilling.holes}</span>
        </p>
      </div>
      <ul className="grid gap-1 text-sm text-[var(--foreground)] sm:grid-cols-2">
        {priced.map((row) => (
          <li
            key={row.diameter}
            className="flex justify-between gap-3 border-b border-[color:var(--line)] py-1.5"
          >
            <span>{drillingDiameter(row.diameter)}</span>
            <span className="text-right">
              {formatDrillingRow(row)}{" "}
              <span className="font-semibold whitespace-nowrap">
                = {row.holes} шт.
              </span>
              <span className="block text-xs text-[var(--muted)]">
                {row.price === null
                  ? "цену назовёт менеджер"
                  : `× ${row.price} сом = ${formatPrice(row.cost)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between gap-3 text-sm text-[var(--foreground)]">
        <span>
          Присадка по прайсу{unpriced ? " (без отверстий без цены)" : ""}
        </span>
        <span className="font-semibold">{formatPrice(total)}</span>
      </p>
      <p className="text-xs text-[var(--muted)]">
        Посчитано по фурнитуре в файле проекта так же, как отверстия уходят на
        станок. Окончательно присадку подтвердит менеджер.
      </p>
    </section>
  );
}
