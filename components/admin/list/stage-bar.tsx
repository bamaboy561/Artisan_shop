import { cn } from "@/lib/utils";

// Где заявка в цеху: пять отрезков Приём → Распил → Кромка → Присадка →
// Выдача. Залитые — пройдено, тёмный — сейчас.
export function StageBar({
  step,
  label,
  note,
}: {
  // 0 — не запущена, 1..5 — этап.
  step: number;
  label: string;
  note?: string | null;
}) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center gap-[3px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((index) => (
          <i
            key={index}
            className={cn(
              "h-1.5 w-[18px] rounded-full bg-[var(--line)]",
              index < step && "bg-[#f5b544]",
              index === step &&
                (step === 5 ? "bg-emerald-500" : "bg-[var(--accent)]"),
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[12.5px] text-[var(--muted)]">
        {label}
        {note ? (
          <span className="font-semibold text-emerald-700"> · {note}</span>
        ) : null}
      </p>
    </div>
  );
}
