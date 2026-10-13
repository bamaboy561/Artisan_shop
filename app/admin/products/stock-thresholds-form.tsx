import { saveStockThresholdsAction } from "@/app/admin/products/stock-threshold-actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Input } from "@/components/ui/input";
import { CategoryKind } from "@/generated/prisma";
import {
  MAX_STOCK_THRESHOLD,
  type StockThresholds,
} from "@/lib/server/stock-thresholds";

const fields = [
  { kind: CategoryKind.PLATE, label: "Плиты, листов" },
  { kind: CategoryKind.FITTINGS, label: "Фурнитура, штук" },
  { kind: CategoryKind.OTHER, label: "Остальное, штук" },
];

// Пороги для списка «Товары заканчиваются» на главной админки и в утренней
// сводке.
export function StockThresholdsForm({
  thresholds,
}: {
  thresholds: StockThresholds;
}) {
  return (
    <details className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/88 p-3 sm:p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Когда товар считается заканчивающимся
        </span>
        <span className="text-xs text-[var(--muted)]">
          плиты {thresholds.PLATE} · фурнитура {thresholds.FITTINGS} · остальное{" "}
          {thresholds.OTHER}
        </span>
      </summary>
      <form
        action={saveStockThresholdsAction}
        className="mt-4 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
      >
        {fields.map((field) => (
          <label key={field.kind} className="grid gap-1.5 text-sm font-medium">
            {field.label}
            <Input
              type="number"
              name={field.kind}
              min={0}
              max={MAX_STOCK_THRESHOLD}
              step={1}
              defaultValue={thresholds[field.kind]}
              required
            />
          </label>
        ))}
        <AdminSubmitButton
          type="submit"
          idleLabel="Сохранить"
          pendingLabel="Сохраняем…"
        />
      </form>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        Товар с остатком не больше этого числа попадает в блок «Требует
        внимания» на главной и в утреннюю сводку в Telegram. Ноль выключает
        список для этой группы. На витрине сайта это ничего не меняет.
      </p>
    </details>
  );
}
