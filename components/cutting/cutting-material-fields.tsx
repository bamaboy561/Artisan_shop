import { Input } from "@/components/ui/input";
import type { CuttingExtras } from "@/features/cutting/quote";
import { otherWorks, workUnitLabel } from "@/features/cutting/site-prices";

// Другие работы: ХДФ, HPL, столешница, утолщёнка, Gola — у каждой своя
// цена в «Прайс работ». Листы ЛДСП — в поле «Количество листов».
// Имена полей читает cuttingExtrasFromForm.
export function CuttingMaterialFields({
  extras,
  group = "material",
}: {
  extras?: CuttingExtras | null;
  // hardware — отверстия под фурнитуру (минификс, конфирмат…).
  group?: "material" | "hardware";
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {otherWorks
        .filter((work) => work.group === group)
        .map((work) => (
          <label
            key={work.key}
            className="grid gap-1 text-xs font-medium text-[var(--foreground)]"
          >
            {work.label}, {workUnitLabel[work.unit].count}
            <Input
              name={work.key}
              type="number"
              min={0}
              step={work.unit === "m" ? 0.01 : 1}
              inputMode={work.unit === "m" ? "decimal" : "numeric"}
              defaultValue={extras?.[work.key] || ""}
              placeholder="0"
              className="h-9 px-2 sm:h-9 sm:px-2"
            />
          </label>
        ))}
    </div>
  );
}
