import { Input } from "@/components/ui/input";
import { drillingDiameters } from "@/features/cutting/site-prices";
import type { CuttingExtras } from "@/features/cutting/quote";

// Поля присадки и фрезеровки для менеджера: отверстий по диаметрам и
// метры фрезеровки. Имена полей читает cuttingExtrasFromForm.
export function CuttingExtrasFields({
  extras,
}: {
  extras?: CuttingExtras | null;
}) {
  const diameters = [
    ...new Set([
      ...drillingDiameters.map(String),
      ...Object.keys(extras?.drilling ?? {}),
    ]),
  ].sort((left, right) => Number(left) - Number(right));

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {diameters.map((diameter) => (
          <label
            key={diameter}
            className="grid gap-1 text-xs font-medium text-[var(--foreground)]"
          >
            Ø{diameter.replace(".", ",")} мм, отв.
            <Input
              name={`drill_${diameter}`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={extras?.drilling[diameter] || ""}
              placeholder="0"
              className="h-9 px-2 sm:h-9 sm:px-2"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium text-[var(--foreground)]">
          Фрезеровка (скругления), м
          <Input
            name="curveMeters"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            defaultValue={extras?.curveMeters || ""}
            placeholder="0"
            className="h-9 px-2 sm:h-9 sm:px-2"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-[var(--foreground)]">
          Пропил под углом, м
          <Input
            name="bevelMeters"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            defaultValue={extras?.bevelMeters || ""}
            placeholder="0"
            className="h-9 px-2 sm:h-9 sm:px-2"
          />
        </label>
      </div>
    </div>
  );
}
