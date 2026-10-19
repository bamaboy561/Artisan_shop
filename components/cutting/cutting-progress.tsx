import { Check, Clock3, MapPin } from "lucide-react";

import { CuttingStage } from "@/generated/prisma";
import {
  cuttingStageLabels,
  cuttingStageSteps,
  getCuttingStageIndex,
} from "@/features/cutting/progress";
import { cn } from "@/lib/utils";

type CuttingProgressProps = {
  stage: CuttingStage | null | undefined;
  pickupCell?: string | null;
  updatedAt?: Date | string | null;
  compact?: boolean;
};

function formatUpdatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CuttingProgress({
  stage,
  pickupCell,
  updatedAt,
  compact = false,
}: CuttingProgressProps) {
  const currentIndex = getCuttingStageIndex(stage);

  return (
    <div className="min-w-[230px]" aria-label="Этапы выполнения распила">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {stage ? cuttingStageLabels[stage] : "Ожидает запуска"}
        </p>
        {stage === CuttingStage.READY_FOR_PICKUP && pickupCell ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <MapPin className="size-3.5" aria-hidden="true" />
            Ячейка № {pickupCell}
          </span>
        ) : null}
      </div>

      <ol className={cn("mt-3 grid", compact ? "gap-1.5" : "gap-2.5")}>
        {cuttingStageSteps.map((step, index) => {
          const isDone = currentIndex > index;
          const isCurrent = currentIndex === index;

          return (
            <li
              key={step.stage}
              className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2.5"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  isDone && "border-emerald-600 bg-emerald-600 text-white",
                  isCurrent &&
                    "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]",
                  !isDone &&
                    !isCurrent &&
                    "border-[color:var(--line-strong)] bg-[var(--surface-strong)] text-[var(--muted)]",
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 pt-0.5">
                <span
                  className={cn(
                    "block text-xs leading-5",
                    isCurrent || isDone
                      ? "font-semibold text-[var(--foreground)]"
                      : "text-[var(--muted)]",
                  )}
                >
                  {step.label}
                </span>
                {!compact ? (
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {updatedAt ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Обновлено {formatUpdatedAt(updatedAt)}
        </p>
      ) : null}
    </div>
  );
}
