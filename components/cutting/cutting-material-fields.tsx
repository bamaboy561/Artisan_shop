import { Input } from "@/components/ui/input";
import type { CuttingExtras } from "@/features/cutting/quote";

// ХДФ, HPL и столешница: у каждого своя цена в «Прайс работ». Листы ЛДСП —
// в поле «Количество листов». Имена полей читает cuttingExtrasFromForm.
const fields = [
  {
    name: "hdfSheets",
    label: "ХДФ, листов",
    step: 1,
    mode: "numeric",
  },
  {
    name: "hplSheets",
    label: "HPL, листов",
    step: 1,
    mode: "numeric",
  },
  {
    name: "countertopCutMeters",
    label: "Пропил столешницы, м",
    step: 0.01,
    mode: "decimal",
  },
  {
    name: "countertopEdgeMeters",
    label: "Закатка столешницы, м",
    step: 0.01,
    mode: "decimal",
  },
] as const;

export function CuttingMaterialFields({
  extras,
}: {
  extras?: CuttingExtras | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {fields.map((field) => (
        <label
          key={field.name}
          className="grid gap-1 text-xs font-medium text-[var(--foreground)]"
        >
          {field.label}
          <Input
            name={field.name}
            type="number"
            min={0}
            step={field.step}
            inputMode={field.mode}
            defaultValue={extras?.[field.name] || ""}
            placeholder="0"
            className="h-9 px-2 sm:h-9 sm:px-2"
          />
        </label>
      ))}
    </div>
  );
}
