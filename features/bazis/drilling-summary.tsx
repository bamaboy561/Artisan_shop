import type { BazisDrilling } from "@/lib/bazis-b3d";

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
  if (!drilling || drilling.holes === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-[#252b29]">Присадка</h2>
        <p className="text-sm text-[#252b29]">
          Всего отверстий:{" "}
          <span className="font-semibold">{drilling.holes}</span>
        </p>
      </div>
      <ul className="grid gap-1 text-sm text-[#252b29] sm:grid-cols-2">
        {drilling.rows.map((row) => (
          <li
            key={row.diameter}
            className="flex justify-between gap-3 border-b border-[#e1e5e1] py-1.5"
          >
            <span>{drillingDiameter(row.diameter)}</span>
            <span className="text-right">
              {formatDrillingRow(row)}{" "}
              <span className="font-semibold whitespace-nowrap">
                = {row.face + row.edge} шт.
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[#69716d]">
        Посчитано по фурнитуре в файле проекта так же, как отверстия уходят на
        станок. Окончательно присадку подтвердит менеджер.
      </p>
    </section>
  );
}
